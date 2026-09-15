# PrivacyGuard AI - BA Requirements

## 1. Executive Summary & Problem Statement

### Executive Summary

PrivacyGuard AI la tro ly phat hien va che mo thong tin ca nhan (Personally Identifiable Information - PII) trong dataset truoc khi Data Analyst chia se, phan tich hoac xuat ban du lieu. He thong ket hop quet tu dong, cham diem rui ro, preview truoc/sau, human confirmation gate va audit report. Muc tieu la giam kha nang chia se nham du lieu ca nhan trong khi van duy tri quy trinh phan tich nhanh, co the giai trinh va truy vet.

### Problem Statement

Theo Nghi dinh 13/2023/ND-CP ve bao ve du lieu ca nhan, du lieu ca nhan phai duoc xu ly dung muc dich, dung pham vi, co bien phap bao ve va kiem soat truy cap phu hop. Trong thuc te, Data Analyst thuong lam viec voi file CSV, bang trich xuat hoac dataset test co the chua ho ten, so dien thoai, email, CCCD/CMND, dia chi, thong tin tai chinh va cac truong dinh danh khac. Viec kiem tra thu cong de bo sot PII, nhan dien sai muc do nhay cam, hoac gui nham raw PII qua kenh chia se.

Cong cu can tu dong scan dataset, detect PII theo gia tri va ten cot, tong hop rui ro, cho phep xem truoc ket qua masking ma khong phat raw PII, sau do chi apply khi nguoi co tham quyen xac nhan dung pham vi. Moi thao tac ghi phai co dau vet audit va phan biet ro READ voi WRITE.

## 2. Target Personas

### Data Analyst - Requester/Viewer

- Muc tieu: nhanh chong biet cot nao co PII, muc rui ro va ket qua che mo.
- Quyen: goi READ tools, xem summary va preview da redact; gui yeu cau masking.
- Gioi han: khong tu dong thuc thi WRITE; khong duoc xem raw PII trong output tro ly.
- Thanh cong: co dataset sanitized de chia se va biet trang thai yeu cau.

### Data Protection Officer (DPO) - Reviewer/Approver

- Muc tieu: kiem soat co so, muc do masking, tinh hop le cua muc dich va audit trail.
- Quyen: review scope/strategy, approve hoac reject WRITE, yeu cau preview lai.
- Gioi han: confirmation chi ap dung cho dung dataset, columns va strategy da preview; thay doi pham vi lam mat confirmation cu.
- Thanh cong: moi thay doi co nguoi duyet, thoi diem, pham vi va ket qua truy vet duoc.

## 3. User Stories

### US-01: Quet va phat hien PII (Scan & Detect)

**As a** Data Analyst, **I want to** quet dataset va phat hien cac truong co kha nang la PII, **So that** toi biet pham vi can bao ve truoc khi chia se.

**Pre-conditions**

- Dataset ton tai va requester co quyen xem metadata/du lieu da duoc kiem soat.
- `dataset_id` hop le.

**Acceptance Criteria**

- **Given** dataset_id hop le, **When** Analyst yeu cau quet, **Then** agent goi `scan_dataset` va tra ket qua khong lo raw PII.
- **Given** scan da hoan tat, **When** Analyst yeu cau phat hien chi tiet, **Then** agent goi `detect_pii` va nhom ket qua theo column/type/sensitivity.
- **Given** dataset khong ton tai hoac khong co quyen, **When** scan duoc yeu cau, **Then** agent khong goi WRITE, thong bao loi an toan va yeu cau dataset_id/quyen phu hop.

**Post-conditions**

- Co scan/detection result co the dung lam dau vao cho summary va preview.
- Khong raw PII nao xuat hien trong phan hoi.

**Tools lien quan:** `scan_dataset`, `detect_pii`.

### US-02: Xem tom tat rui ro PII (Summary & Risk Scoring)

**As a** Data Analyst, **I want to** xem tom tat so luong va muc do nhay cam cua PII, **So that** toi uu tien xu ly va cung cap thong tin du cho DPO review.

**Pre-conditions**

- Dataset da duoc scan hoac service co the tao summary tu dataset_id.

**Acceptance Criteria**

- **Given** dataset_id hop le, **When** Analyst yeu cau summary, **Then** agent goi `get_pii_summary`.
- **Given** co nhieu muc do sensitivity, **When** summary tra ve, **Then** output co nhom risk, so cot/record bi anh huong va canh bao xu ly, khong hien gia tri goc.
- **Given** chua co PII hoac khong phat hien PII, **When** summary tra ve, **Then** agent noi ro zero finding/low risk va khong tu y apply masking.

**Post-conditions**

- Requester co risk summary co the truy vet theo dataset.
- Chua co thay doi du lieu.

**Tools lien quan:** `get_pii_summary`.

### US-03: Xem truoc ban che mo (Preview Masking)

**As a** Data Analyst, **I want to** xem truoc before/after da redact theo cot va strategy, **So that** toi kiem tra masking co phu hop truoc khi xin phe duyet.

**Pre-conditions**

- Dataset da scan/detect hoac columns da duoc xac dinh.
- Moi column va strategy nam trong policy cho phep.

**Acceptance Criteria**

- **Given** dataset, columns va strategy hop le, **When** Analyst yeu cau preview, **Then** agent goi `preview_masking`.
- **Given** preview co raw PII, **When** agent hien ket qua, **Then** before/after phai duoc redact/tokenize, chi hien format va sample an toan.
- **Given** columns/strategy khong hop le, **When** preview duoc yeu cau, **Then** agent tu choi tool call hoac tra validation error, khong goi WRITE.

**Post-conditions**

- Tao preview snapshot gan voi dataset, columns va strategy.
- Confirmation chua duoc xem la hop le chi vi preview thanh cong.

**Tools lien quan:** `preview_masking`, co the dung `detect_pii` va `get_pii_summary` de bo tro.

### US-04: Duyet va thuc thi che mo (Confirmation & Apply Masking)

**As a** DPO, **I want to** duyet ro dataset, columns, strategy truoc khi apply, **So that** khong co thao tac ghi nao xay ra ngoai y muon va co the truy vet nguoi phe duyet.

**Pre-conditions**

- Preview hien tai ton tai va scope khop yeu cau.
- DPO da xem summary/preview.
- Co confirmation ro rang cho dung `dataset_id`, `columns`, `strategy`; requester/DPO co quyen.

**Acceptance Criteria**

- **Given** chua co confirmation, **When** user yeu cau apply, **Then** agent hoi xac nhan va khong goi `apply_masking`.
- **Given** confirmation hop le va scope khong doi, **When** DPO phe duyet, **Then** agent goi `apply_masking` dung arguments da duoc preview.
- **Given** user thay doi columns/strategy/dataset sau confirmation, **When** agent nhan thay doi, **Then** confirmation cu bi invalidated, agent phai preview/xac nhan lai.
- **Given** user yeu cau bo qua phe duyet, **When** apply duoc yeu cau, **Then** agent tu choi va giu nguyen du lieu.

**Post-conditions**

- Neu PASS: dataset duoc masked, tra status va luu audit metadata.
- Neu REJECT/CANCEL: dataset khong doi va confirmation cu khong con hieu luc.

**Tools lien quan:** `preview_masking`, `apply_masking`, optional `restore_original`.

### US-05: Tai bao cao kiem toan (Audit Report)

**As a** DPO, **I want to** tao bao cao audit ve phat hien, phe duyet va masking, **So that** to chuc co bang chung tuan thu va co the truy vet su kien.

**Pre-conditions**

- Dataset ton tai.
- Audit metadata/operation history co san.
- DPO co quyen tao report.

**Acceptance Criteria**

- **Given** audit scope hop le, **When** DPO yeu cau report, **Then** agent yeu cau human confirmation truoc khi goi `generate_audit_report`.
- **Given** confirmation hop le, **When** report duoc generate, **Then** report ghi dataset, thoi diem, actor, findings, strategy, status va khong ghi raw PII.
- **Given** user doi scope sau confirmation, **When** report duoc yeu cau, **Then** confirmation bi invalidated va phai xin lai.

**Post-conditions**

- Bao cao audit duoc tao hoac loi duoc ghi ro; khong co raw PII trong report output.

**Tools lien quan:** `generate_audit_report`, co the tham chieu `get_pii_summary`, `preview_masking`.

## 4. Business Workflow & Safety State Machine

### Text flow

```text
[REQUEST dataset_id]
        |
        v
[READ: scan_dataset]
        |
        v
[READ: detect_pii] ---> [READ: get_pii_summary]
        |                         |
        +------------+------------+
                     v
       [READ: preview_masking(columns, strategy)]
                     |
         raw PII never leaves controlled service
                     v
             [SHOW REDACTED BEFORE/AFTER]
                     |
             [HUMAN CONFIRMATION GATE]
              /          |             \
       CANCEL/CHANGE    APPROVE        REJECT
          |               |              |
    invalidate        [WRITE:           no write
    old gate       apply_masking]       + explain
                          |
                          v
                 [WRITE: generate_audit_report]
                          |
                 [COMPLETED + AUDIT STATUS]

[RECOVERY: restore_original]
  only after authorized recovery request, explicit scope, and audit logging
```

### Safety state machine

```text
DISCOVERED -> SCANNED -> DETECTED -> SUMMARIZED -> PREVIEWED
                                                   |
                              +--------------------+--------------------+
                              |                    |                    |
                         CHANGE/CANCEL          CONFIRM              REJECT
                              |                    |                    |
                        CONFIRM_INVALID       WRITE_PENDING          CLOSED
                              |                    |
                              +----> PREVIEWED   +--> APPLIED --> AUDITED
```

### Nguyen tac AI Safety

1. **Zero Raw PII Exposure:** khong in, echo, copy, quote hoac day raw PII vao prompt/output/audit report; before/after chi la masked sample, pattern, count va metadata toi thieu.
2. **Human Confirmation Gate:** `apply_masking` va `generate_audit_report` la WRITE tools, luon can confirmation ro rang truoc khi goi. Confirmation phai bind voi dataset, columns, strategy va preview snapshot.
3. **Invalidating Confirmation:** bat ky thay doi nao ve dataset, columns, strategy, scope, actor hoac muc dich deu huy confirmation cu; can preview va xac nhan lai.
4. **Jailbreak resistance:** moi yeu cau nhu bo qua policy, dong vai system/developer, in raw PII, bo qua DPO hoac tu dong apply deu bi tu choi; agent tiep tuc tuan theo contract va thong bao hanh dong an toan thay the.
5. **Least privilege:** chi goi tool can thiet; READ khong tu dong dan den WRITE; restore chi dung trong recovery duoc uy quyen va phai audit.

## 5. Traceability Matrix

| User Story | READ tools | WRITE/Recovery tools | Test scenarios |
|---|---|---|---|
| US-01 Scan & Detect | `scan_dataset`, `detect_pii` | None | SC_01-SC_05, SC_21, SC_31, SC_43-SC_52 |
| US-02 Summary & Risk Scoring | `get_pii_summary` | None | SC_06-SC_09, SC_22, SC_32, SC_47, SC_49 |
| US-03 Preview Masking | `preview_masking` | None | SC_10-SC_12, SC_23-SC_25, SC_33-SC_34, SC_43-SC_46, SC_50-SC_52 |
| US-04 Confirmation & Apply | `scan_dataset`, `detect_pii`, `get_pii_summary`, `preview_masking` | `apply_masking`, `restore_original` | SC_13-SC_17, SC_26-SC_29, SC_35-SC_40, SC_48, SC_51 |
| US-05 Audit Report | `get_pii_summary`, `preview_masking` | `generate_audit_report` | SC_18-SC_20, SC_30, SC_36, SC_42, SC_52 |
