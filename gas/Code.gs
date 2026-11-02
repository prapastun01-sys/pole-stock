/**
 * Google Apps Script - ตัวกลางระหว่างเว็บ ↔ Google Drive ↔ Telegram
 *
 * ตั้งค่าที่ Project Settings > Script properties (ไม่ต้องใส่ความลับในโค้ด)
 *   SECRET          = รหัสลับ (ต้องตรงกับ GAS_SECRET ใน Vercel)
 *   ROOT_FOLDER_ID  = ID โฟลเดอร์หลักใน Google Drive (ส่วนท้ายของ URL โฟลเดอร์)
 *   TG_BOT_TOKEN    = token จาก @BotFather
 *   TG_CHAT_ID      = chat id ของกลุ่ม/ผู้รับแจ้งเตือน
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me   |   Who has access: Anyone
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();

    if (!body.secret || body.secret !== props.getProperty('SECRET')) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    if (body.action === 'upload') return json_(uploadImage_(body, props));
    if (body.action === 'notify') return json_(notify_(body, props));

    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, message: 'pole-stock gas is running' });
}

/** บันทึกรูปลงโฟลเดอร์ตาม path ที่ส่งมา เช่น ["เสา","กองA","12 เมตร"] */
function uploadImage_(body, props) {
  var folder = DriveApp.getFolderById(props.getProperty('ROOT_FOLDER_ID'));
  (body.folderPath || []).forEach(function (name) {
    folder = getOrCreateFolder_(folder, name);
  });

  var blob = Utilities.newBlob(
    Utilities.base64Decode(body.data),
    body.mimeType || 'image/jpeg',
    body.filename || 'photo.jpg'
  );
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var id = file.getId();
  return {
    ok: true,
    id: id,
    url: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600', // ใช้แสดงใน <img>
    viewUrl: file.getUrl(),
  };
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** ส่งข้อความเข้า Telegram (รองรับ HTML) */
function notify_(body, props) {
  var token = props.getProperty('TG_BOT_TOKEN');
  var chatId = props.getProperty('TG_CHAT_ID');
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      chat_id: chatId,
      text: body.text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  return { ok: res.getResponseCode() === 200, detail: res.getContentText() };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** รันฟังก์ชันนี้ 1 ครั้งในตัว editor เพื่อกดอนุญาตสิทธิ์ Drive + เชื่อมต่อภายนอก และทดสอบ Telegram */
function testSetup() {
  var props = PropertiesService.getScriptProperties();
  DriveApp.getFolderById(props.getProperty('ROOT_FOLDER_ID')).getName();
  Logger.log(notify_({ text: '✅ ทดสอบแจ้งเตือนระบบเบิกเสา สำเร็จ' }, props));
}
