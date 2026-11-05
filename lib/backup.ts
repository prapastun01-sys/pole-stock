// ตารางที่สำรอง/นำเข้า เรียงตามลำดับที่ต้องนำเข้า (ตารางแม่ก่อน)
export const BACKUP_TABLES = ["areas", "pole_sizes", "accessories", "sites", "withdrawals", "poles"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
// คอลัมน์ที่ฐานข้อมูลคำนวณเอง นำเข้าไม่ได้
export const GENERATED: Record<string, string[]> = { sites: ["label"] };
