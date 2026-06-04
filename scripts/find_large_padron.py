import os

def find_files():
    search_dirs = ["c:/Users/Sate Core i5", "d:/"]
    found = []
    for root_dir in search_dirs:
        print(f"Searching in {root_dir}...")
        for root, dirs, files in os.walk(root_dir):
            # Skip system or irrelevant directories
            if any(p in root for p in ["Windows", "AppData", "node_modules", ".git", "Microsoft", "$RECYCLE.BIN", "System Volume Information"]):
                continue
            for file in files:
                lf = file.lower()
                if "padron" in lf or "mas_pda" in lf or "seccio" in lf or "secc_local" in lf:
                    full_path = os.path.join(root, file)
                    try:
                        size = os.path.getsize(full_path)
                        print(f"Found: {full_path} ({size} bytes)")
                        found.append((full_path, size))
                    except:
                        pass
    print("Search completed.")

find_files()
