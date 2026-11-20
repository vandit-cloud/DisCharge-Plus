"""
Train the follow-up no-show model for DisCharge+.

Data:    Kaggle "Medical Appointment No Shows" by Joni Hoppen (CC BY-NC-SA 4.0),
         110,527 public-hospital appointments, Vitoria, Brazil, 2016.
         Put KaggleV2-May-2016.csv in ml/data/ (git-ignored).
Model:   logistic regression on the five inputs the app also stores.
Output:  server/src/ml/noshow-model.json  (intercept + one weight per input).
         The Node server computes  p = sigmoid(intercept + sum(weight * input))
         so Render never needs Python.

Run:     python ml/train_noshow.py          (from the repo root; takes about a second)
"""

import json
import math
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ml" / "data" / "KaggleV2-May-2016.csv"
OUT = ROOT / "server" / "src" / "ml" / "noshow-model.json"

# The order here is the order of the weights in the JSON. Each one exists in our app too:
#   age            Patient.dateOfBirth
#   male           Patient.gender === 'male'
#   hypertension   DischargePlan.followUpProtocol === 'cardiac'
#   diabetes       DischargePlan.followUpProtocol === 'diabetes'
#   logLeadDays    ln(1 + days from booking to appointment); app: FollowUp.scheduledDate - dischargeDate
#   missedBefore   1 if the patient missed any appointment on an EARLIER day;
#                  app: any earlier follow-up that is 'missed' or overdue (still 'scheduled', date passed)
FEATURES = ["age", "male", "hypertension", "diabetes", "logLeadDays", "missedBefore"]

# ---- 1. Load and clean -------------------------------------------------------------------
df = pd.read_csv(DATA)
rows_loaded = len(df)

scheduled = pd.to_datetime(df["ScheduledDay"]).dt.normalize()
appointment = pd.to_datetime(df["AppointmentDay"]).dt.normalize()
df["leadDays"] = (appointment - scheduled).dt.days
df["appointmentDay"] = appointment
df["noShow"] = (df["No-show"] == "Yes").astype(int)

# History, computed on ALL appointments before any rows are dropped: for each patient and day,
# "did they miss anything on an earlier day?" (same-day visits don't count: their outcome
# isn't known yet when the day starts).
days = df.groupby(["PatientId", "appointmentDay"], as_index=False)["noShow"].max()
days["missedBefore"] = (
    days.groupby("PatientId")["noShow"].cummax().groupby(days["PatientId"]).shift(1).fillna(0).astype(int)
)
df = df.merge(days[["PatientId", "appointmentDay", "missedBefore"]], on=["PatientId", "appointmentDay"])

df = df[df["Age"] >= 0]          # 1 row has age -1
df = df[df["leadDays"] >= 1]     # drop 5 "before booking" rows AND same-day visits:
                                 # a follow-up is never booked for the same day
rows_used = len(df)

X = pd.DataFrame({
    "age": df["Age"],
    "male": (df["Gender"] == "M").astype(int),
    "hypertension": df["Hipertension"],
    "diabetes": df["Diabetes"],
    # Lead time on a log scale: going from 1 to 7 days changes behaviour much more
    # than going from 60 to 66 days.
    "logLeadDays": np.log1p(df["leadDays"]),
    "missedBefore": df["missedBefore"],
})[FEATURES]
y = df["noShow"]

# ---- 2. Split by patient, so no patient is in both train and test -----------------------
split = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(split.split(X, y, groups=df["PatientId"]))
X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

# ---- 3. Fit ------------------------------------------------------------------------------
# Scaling helps the solver. No class weighting: we want the output to be a real
# probability (the dashboard shows it as "n %"). A "balanced" model would push every
# score towards 50 % even though only ~28 % of patients miss.
scaler = StandardScaler().fit(X_train)
model = LogisticRegression(max_iter=1000)
model.fit(scaler.transform(X_train), y_train)

# ---- 4. Evaluate on the held-out patients ------------------------------------------------
p_train = model.predict_proba(scaler.transform(X_train))[:, 1]
p_test = model.predict_proba(scaler.transform(X_test))[:, 1]
auc = roc_auc_score(y_test, p_test)
# A cut-off of 0.5 would call almost nobody (scores rarely pass 50 %). The real use is
# "phone the riskiest quarter first", so evaluate at the training 75th percentile.
cutoff = float(np.percentile(p_train, 75))
tn, fp, fn, tp = confusion_matrix(y_test, (p_test >= cutoff).astype(int)).ravel()

print(f"Rows loaded {rows_loaded:,}; used {rows_used:,} (age >= 0, lead >= 1 day)")
print(f"No-show rate in used rows: {y.mean():.1%}")
print(f"Train {len(y_train):,} rows / test {len(y_test):,} rows (split by PatientId)")
print(f"Test AUC: {auc:.3f}   (0.5 = coin toss, 1.0 = perfect)")
print(f"Confusion matrix when the top quarter (score >= {cutoff:.3f}) is flagged:")
print("  (rows = actual, cols = predicted)")
print(f"                 attended  no-show")
print(f"  attended       {tn:8,}  {fp:7,}")
print(f"  no-show        {fn:8,}  {tp:7,}")
print(f"  recall (no-shows caught) {tp / (tp + fn):.1%}   precision {tp / (tp + fp):.1%}")

# ---- 5. Undo the scaling so Node can use raw inputs --------------------------------------
# On scaled inputs: z = b + sum(w * (x - mean) / std)
#                     = (b - sum(w * mean / std)) + sum((w / std) * x)
w_scaled = model.coef_[0]
weights = w_scaled / scaler.scale_
intercept = model.intercept_[0] - float(np.sum(w_scaled * scaler.mean_ / scaler.scale_))

# Sanity check: the raw-input formula must give the same probabilities.
z = intercept + X_test.to_numpy() @ weights
assert np.allclose(1 / (1 + np.exp(-z)), p_test), "unscaled weights do not match the model"

print("\nWeights on raw inputs (positive = more likely to miss):")
for name, w in zip(FEATURES, weights):
    print(f"  {name:13} {w:+.4f}   odds x{math.exp(w):.3f} per unit")
print(f"  {'intercept':13} {intercept:+.4f}")

# Where the scores fall, to help pick Low / Medium / High cut-offs.
percentiles = {f"p{q}": round(float(np.percentile(p_train, q)), 3) for q in (10, 25, 50, 75, 90)}
print(f"Training scores: {percentiles}")

# ---- 6. Export ---------------------------------------------------------------------------
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    "model": "logistic_regression",
    "trainedOn": date.today().isoformat(),
    "features": FEATURES,
    "weights": {name: round(float(w), 6) for name, w in zip(FEATURES, weights)},
    "intercept": round(intercept, 6),
    "metrics": {
        "testAuc": round(float(auc), 3),
        "flagTopQuarter": {"cutoff": round(cutoff, 3), "recall": round(tp / (tp + fn), 3),
                           "precision": round(tp / (tp + fp), 3)},
        "trainRows": int(len(y_train)),
        "testRows": int(len(y_test)),
        "noShowRate": round(float(y.mean()), 3),
        "scorePercentiles": percentiles,
    },
    "dataset": "Medical Appointment No Shows, Joni Hoppen, Kaggle "
               "(joniarroba/noshowappointments), Vitoria, Brazil, 2016",
    "licence": "CC BY-NC-SA 4.0: non-commercial use only; derived model carries the same licence",
}, indent=2) + "\n")
print(f"\nWrote {OUT.relative_to(ROOT)}")
