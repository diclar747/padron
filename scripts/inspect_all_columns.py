import pandas as pd

excel_path = "d:/Respaldo/numeros/padron encarnacion.xlsx"
print("Reading Excel file...")
df = pd.read_excel(excel_path)

print("Non-null counts per column:")
for col in df.columns:
    non_null = df[col].notnull().sum()
    print(f"- {col}: {non_null} non-null values")

print("\nFirst 5 rows for populated columns:")
populated_cols = [col for col in df.columns if df[col].notnull().sum() > 0]
print(df[populated_cols].head().to_string())
