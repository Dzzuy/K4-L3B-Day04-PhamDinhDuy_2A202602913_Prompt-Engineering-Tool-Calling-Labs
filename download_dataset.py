import os
import shutil
import kagglehub
import pandas as pd

# 1. Tải dataset từ Kaggle
print("⏳ Đang tải pii-external-dataset từ Kaggle...")
download_path = kagglehub.dataset_download("alejopaullier/pii-external-dataset")
print(f"✅ Đã tải về cache tại: {download_path}")

# 2. Xác định thư mục lưu trữ trong dự án
target_dir = os.path.join("starter_v0", "data")
os.makedirs(target_dir, exist_ok=True)

# 3. Copy file pii_dataset.csv vào thư mục dự án
src_csv = os.path.join(download_path, "pii_dataset.csv")
dst_csv = os.path.join(target_dir, "pii_dataset.csv")

if os.path.exists(src_csv):
    shutil.copy(src_csv, dst_csv)
    print(f"📦 Đã copy {src_csv} -> {dst_csv}")
    
    # 4. Đọc thử dữ liệu và kiểm tra cấu trúc
    df = pd.read_csv(dst_csv)
    print("\n--- THÔNG TIN FILE PII_DATASET.CSV ---")
    print(f"• Tổng số dòng: {len(df)}")
    print(f"• Danh sách cột: {list(df.columns)}")
    print("\n• 3 dòng đầu tiên:")
    print(df[['document', 'text', 'labels']].head(3))

    # 5. Tạo thêm 1 file mẫu nhỏ (100 dòng) để nhóm test Agent siêu nhanh
    sample_csv = os.path.join(target_dir, "sample_pii.csv")
    df.head(100).to_csv(sample_csv, index=False)
    print(f"\n💡 Đã tạo thêm file mẫu nhỏ test nhanh: {sample_csv}")
else:
    print(f"❌ Không tìm thấy file pii_dataset.csv trong thư mục tải về: {download_path}")