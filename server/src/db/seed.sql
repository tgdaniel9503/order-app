INSERT INTO menus (name, description, price, image_url, stock_quantity)
VALUES
  ('아메리카노(ICE)', '시원하고 깔끔한 풍미의 아이스 아메리카노', 4000, '/images/americano-ice.jpg', 10),
  ('아메리카노(HOT)', '진한 향과 밸런스를 가진 따뜻한 아메리카노', 4000, '/images/americano-hot.jpg', 10),
  ('카페라떼', '부드러운 우유와 에스프레소가 어우러진 라떼', 5000, '/images/caffe-latte.jpg', 10)
ON CONFLICT DO NOTHING;

INSERT INTO menu_options (menu_id, name, price)
SELECT menus.id, option_values.name, option_values.price
FROM menus
CROSS JOIN (
  VALUES
    ('샷 추가', 500),
    ('시럽 추가', 0)
) AS option_values(name, price)
WHERE menus.name IN ('아메리카노(ICE)', '아메리카노(HOT)', '카페라떼')
ON CONFLICT (menu_id, name) DO NOTHING;
