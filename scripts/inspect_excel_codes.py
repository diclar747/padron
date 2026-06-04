import pandas as pd

excel_path = "c:/Users/Sate Core i5/Downloads/enc_limpio_expandido.xlsx"
print("Reading Excel file...")
df = pd.read_excel(excel_path)

print("Unique values in 'codigo' column:")
unique_codes = df['codigo'].unique()
print("Number of unique codes:", len(unique_codes))
print("Sorted unique codes:", sorted(unique_codes))

print("\nSample records for each unique code:")
for code in sorted(unique_codes)[:10]:
    sample = df[df['codigo'] == code].head(2)
    print(f"Code {code}:")
    print(sample.to_string(index=False))
