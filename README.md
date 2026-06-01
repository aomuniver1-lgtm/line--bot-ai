# line--bot-ai

โปรเจกต์ตัวอย่างสำหรับบริการตอบคำถามจากไฟล์ FAQ (CSV)

การติดตั้ง: รันคำสั่งต่อไปนี้ในโฟลเดอร์ `line oa chatbot`:

```bash
npm install
```

วิธีเรียกใช้งาน API (ตัวอย่าง):

GET `/api/faq?q=ค้นหา` จะคืน JSON `{ reply: "..." }`
