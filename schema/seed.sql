INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES
  (1, 'カフェ', 10),
  (2, 'レストラン', 20),
  (3, '観光', 30),
  (4, '公園', 40),
  (5, 'その他', 99);

INSERT INTO pins (
  title,
  description,
  lat,
  lng,
  category_id,
  address,
  memo,
  url,
  is_public
) VALUES
(
  'サンプルカフェ',
  '駅近で集まりやすい、落ち着いた雰囲気のカフェです。',
  35.681236,
  139.767125,
  1,
  '東京都千代田区丸の内1丁目',
  '待ち合わせ候補。席数は事前確認推奨。',
  'https://example.com',
  1
);

INSERT INTO pin_display_settings (
  pin_id,
  show_description,
  show_address,
  show_memo,
  show_url,
  show_image
)
SELECT id, 1, 1, 1, 1, 1
FROM pins
WHERE title = 'サンプルカフェ';
