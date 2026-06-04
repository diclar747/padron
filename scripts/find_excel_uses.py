import os

def find_mentions():
    search_dirs = ["c:/Users/Sate Core i5", "d:/"]
    for root_dir in search_dirs:
        print(f"Searching for code mentions in {root_dir}...")
        for root, dirs, files in os.walk(root_dir):
            if any(p in root for p in ["Windows", "AppData", "node_modules", ".git", "Microsoft", "$RECYCLE.BIN", "System Volume Information"]):
                continue
            for file in files:
                if file.endswith(('.js', '.py', '.bat', '.sql', '.sh', '.txt')):
                    full_path = os.path.join(root, file)
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            if 'enc_limpio' in content or 'enc_limpio_expandido' in content or 'limpio_expandido' in content:
                                print(f"Found mention in {full_path}")
                    except Exception as e:
                        pass

find_mentions()
