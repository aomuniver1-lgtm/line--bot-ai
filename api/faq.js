const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    const csvPath = path.join(__dirname, '..', 'data', 'faq.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(500).json({ error: 'FAQ file missing' });
    }
    const raw = fs.readFileSync(csvPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return res.status(500).json({ error: 'FAQ has no data' });
    }
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
      return obj;
    });

    const q = (req.query.q || (req.body && req.body.q) || '').trim();
    if (!q) {
      return res.status(400).json({ reply: 'ยังไม่มีข้อมูลส่วนนี้ในระบบครับ กรุณาตรวจสอบกับผู้รับผิดชอบอีกครั้งครับ' });
    }

    const match = rows.find(r => Object.values(r).some(v => v === q));
    if (!match) {
      return res.json({ reply: 'ยังไม่มีข้อมูลส่วนนี้ในระบบครับ กรุณาตรวจสอบกับผู้รับผิดชอบอีกครั้งครับ' });
    }

    const values = Object.values(match).filter(Boolean);
    const reply = values.length ? values.join(' ') : 'ยังไม่มีข้อมูลส่วนนี้ในระบบครับ กรุณาตรวจสอบกับผู้รับผิดชอบอีกครั้งครับ';
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
