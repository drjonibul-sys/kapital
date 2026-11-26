export class LocalStore {
  constructor(validate, normalize, indexedDB = globalThis.indexedDB) { this.validate = validate; this.normalize = normalize; this.indexedDB = indexedDB; }
  async open() {
    if (!this.indexedDB) throw new Error('Хранилище браузера недоступно. Откройте приложение в обычной вкладке Firefox по постоянной ссылке.');
    this.db = await new Promise((resolve, reject) => {
      const request = this.indexedDB.open('kapital-focus-local', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Не удалось открыть хранилище Firefox. Записи не изменены.'));
      request.onblocked = () => reject(new Error('Закройте остальные вкладки «Капитал» и повторите открытие.'));
    });
    this.db.onversionchange = () => this.db.close();
    return this;
  }
  async read(key = 'main', {raw=false}={}) {
    const value = await new Promise((resolve, reject) => {
      const request = this.db.transaction('documents').objectStore('documents').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Не удалось прочитать локальные записи.'));
    });
    if (value) { if(!raw){value.data = this.normalize(value.data); this.validate(value.data);} if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Некорректная версия локальных данных.'); }
    return value;
  }
  // Вызывается до первой записи новой версией: сохраняет данные в том виде, в каком их оставила прежняя.
  async keepBeforeUpdate(version) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('documents', 'readwrite'), records = transaction.objectStore('documents');
      let copied = false;
      const seen = records.get('app-version');
      seen.onsuccess = () => {
        if (seen.result === version) return;
        const current = records.get('main');
        current.onsuccess = () => {
          if (current.result) { records.put(current.result, 'before-update'); copied = true; }
          records.put(version, 'app-version');
        };
      };
      transaction.oncomplete = () => resolve(copied);
      transaction.onerror = transaction.onabort = () => reject(new Error('Не удалось сохранить копию данных перед обновлением. Экспортируйте JSON-копию в настройках.'));
    });
  }
  async save(data, expectedRevision, {beforeImport=false}={}) {
    this.validate(data);
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('documents', 'readwrite'), records = transaction.objectStore('documents');
      let output, cause;
      const request = records.get('main');
      request.onsuccess = () => {
        const current = request.result;
        if ((current?.revision || 0) !== expectedRevision) { cause = new Error('Записи изменились в другой вкладке. Обновите данные перед повторным вводом.'); cause.code = 'CONFLICT'; transaction.abort(); return; }
        output = { data: structuredClone(data), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
        if (current) records.put(current, 'backup');
        if (current && current.data?.schemaVersion !== data.schemaVersion) records.put(current, 'before-upgrade');
        if (current && beforeImport) records.put(current, 'before-import');
        records.put(output, 'main');
      };
      transaction.oncomplete = () => resolve(output);
      transaction.onerror = transaction.onabort = () => reject(cause || new Error('Не удалось сохранить данные на телефоне. Возможно, хранилище заполнено. Записи не изменены.'));
    });
  }
}
