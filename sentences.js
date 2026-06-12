// ============================================================
// sentences.js — the sentence pool
// Each sentence is EXACTLY 67 characters, alternating EN / TH.
// Array index === sentence_id stored in the scores table.
// ============================================================

export const SENTENCES = [
  /* 0 EN */ "The quick fingers of a champion never hesitate when speed matters!!",
  /* 1 TH */ "พิมพ์ให้เร็วที่สุด แล้วส่งก่อนใครๆ นี่คือสมรภูมิของนักพิมพ์ยุคใหม่!",
  /* 2 EN */ "Every millisecond counts when racing rivals across the whole globe!",
  /* 3 TH */ "ความเร็วคือพลัง ความแม่นยำคือชัยชนะ จงพิมพ์ทุกคำด้วยหัวใจของแชมป์!!",
  /* 4 EN */ "Type like lightning, submit like thunder, and claim the top spot!!!",
  /* 5 TH */ "นิ้วสัมผัสแป้นพิมพ์ ใจจดจ่อกับทุกตัวอักษร เส้นชัยรออยู่ตรงหน้าแล้ว!",
  /* 6 EN */ "Cyan letters glow brighter as your hands fly across the keyboard!!!",
  /* 7 TH */ "อย่ารอช้า เวลาเดินไม่หยุดรอใคร พิมพ์ให้ครบทุกตัวอักษรแล้วกดส่งทันที",
  /* 8 EN */ "Focus your mind, steady your hands, and beat the global record now!",
  /* 9 TH */ "หนึ่งประโยค หนึ่งโอกาส หนึ่งชัยชนะ ผู้ที่เร็วที่สุดคือผู้ชนะเสมอไป!",
];

export function randomSentence() {
  const id = Math.floor(Math.random() * SENTENCES.length);
  return { id, text: SENTENCES[id] };
}
