const statuses = [
  'Планируется',
  'В работе',
  'Выполнен',
  'Передан в пункт выдачи',
  'Принят в пункте выдачи',
  'Завершён'
];

export default function StatusBar({ current, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
      {statuses.map((label, index) => {
        const step = index + 1;
        return (
          <button
            key={step}
            style={{
              background: step === current ? '#4cafef' : '#eee',
              padding: '5px 10px'
            }}
            onClick={() => onChange(step)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
