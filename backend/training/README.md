# Train the Kaggle 41-disease XGBoost model

Use `archive (1).zip` supplied with this project. It contains `dataset.csv` with
4,920 rows and 41 disease labels. This model accepts only symptoms that appear
in that dataset; free patient wording needs a separate text-to-symptom extraction
layer and cannot be made medically correct merely by retraining this table.

## Colab

Upload `archive (1).zip` and `train_kaggle_symptom_model.py`, then run:

```python
!pip -q install xgboost scikit-learn pandas matplotlib
!unzip -o "archive (1).zip" -d kaggle_data
!python train_kaggle_symptom_model.py --dataset kaggle_data/dataset.csv --output symptom_model_artifacts
```

The output folder contains `confusion_matrix.png`, the development accuracy
report, and the three application artifacts: `xgboost_model.pkl`,
`label_encoder.pkl`, and `symptom_columns.json`.

Download only the deployable artifacts:

```python
!zip -r symptom_model_artifacts.zip symptom_model_artifacts
from google.colab import files
files.download("symptom_model_artifacts.zip")
```
