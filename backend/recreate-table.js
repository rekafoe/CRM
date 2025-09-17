const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function recreateTable() {
  const db = await open({
    filename: path.resolve(__dirname, 'data.db'),
    driver: sqlite3.Database
  });

  console.log('🔧 Пересоздаём таблицу daily_reports...\n');

  try {
    // Создаём резервную копию данных
    const backup = await db.all('SELECT * FROM daily_reports');
    console.log(`📦 Сохранили ${backup.length} записей`);

    // Удаляем старую таблицу
    await db.run('DROP TABLE daily_reports');
    console.log('🗑️ Удалили старую таблицу');

    // Создаём новую таблицу БЕЗ ограничения UNIQUE на report_date
    await db.run(`
      CREATE TABLE daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        orders_count INTEGER NOT NULL DEFAULT 0,
        total_revenue REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT,
        user_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Создали новую таблицу без ограничений');

    // Восстанавливаем данные
    for (const record of backup) {
      await db.run(
        'INSERT INTO daily_reports (id, report_date, orders_count, total_revenue, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        record.id, record.report_date, record.orders_count, record.total_revenue, record.created_at, record.updated_at, record.user_id
      );
    }
    console.log(`📥 Восстановили ${backup.length} записей`);

    // Проверяем структуру
    const tableInfo = await db.all("PRAGMA table_info(daily_reports)");
    console.log('\n📋 Новая структура таблицы:');
    tableInfo.forEach(col => {
      console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });

  } catch (e) {
    console.log('❌ Ошибка при пересоздании таблицы:', e.message);
  }

  await db.close();
  console.log('\n✅ Таблица успешно пересоздана!');
}

recreateTable().catch(console.error);
