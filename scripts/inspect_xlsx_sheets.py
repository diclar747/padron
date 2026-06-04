import openpyxl

file_path = "c:/Users/Sate Core i5/Downloads/enc_limpio_expandido.xlsx"
try:
    wb = openpyxl.load_workbook(file_path, read_only=True)
    print("Sheets in workbook:", wb.sheetnames)
except Exception as e:
    print("Error:", e)
