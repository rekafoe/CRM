import { useState, useEffect } from 'react';

export default function Settings({ presets, onSave, onClose }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    setData(JSON.parse(JSON.stringify(presets))); // глубокая копия
  }, [presets]);

  const handleCategoryChange = (index, field, value) => {
    const updated = [...data];
    updated[index][field] = value;
    setData(updated);
  };

  const handleItemChange = (catIndex, itemIndex, field, value) => {
    const updated = [...data];
    updated[catIndex].items[itemIndex][field] = value;
    setData(updated);
  };

  const addCategory = () => {
    setData([...data, { category: 'Новая категория', color: '#000', items: [], extras: [] }]);
  };

  const addItem = (catIndex) => {
    const updated = [...data];
    updated[catIndex].items.push({ description: 'Новый товар', price: 0 });
    setData(updated);
  };

  const saveChanges = () => {
    onSave(data);
    localStorage.setItem('crmPresets', JSON.stringify(data));
    onClose();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Настройки пресетов</h2>
      {data.map((cat, catIndex) => (
        <div key={catIndex} style={{ border: '1px solid #ccc', padding: 10, marginBottom: 10 }}>
          <input
            value={cat.category}
            onChange={(e) => handleCategoryChange(catIndex, 'category', e.target.value)}
            style={{ fontWeight: 'bold', marginBottom: 4 }}
          />
          <input
            type="color"
            value={cat.color}
            onChange={(e) => handleCategoryChange(catIndex, 'color', e.target.value)}
          />
          <h4>Товары</h4>
          {cat.items.map((item, itemIndex) => (
            <div key={itemIndex} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input
                value={item.description}
                onChange={(e) => handleItemChange(catIndex, itemIndex, 'description', e.target.value)}
              />
              <input
                type="number"
                value={item.price}
                onChange={(e) => handleItemChange(catIndex, itemIndex, 'price', parseFloat(e.target.value))}
              />
            </div>
          ))}
          <button onClick={() => addItem(catIndex)}>+ Добавить товар</button>
        </div>
      ))}
      <button onClick={addCategory}>+ Добавить категорию</button>
      <div style={{ marginTop: 10 }}>
        <button onClick={saveChanges} style={{ background: '#4cafef', color: '#fff' }}>Сохранить</button>
        <button onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
