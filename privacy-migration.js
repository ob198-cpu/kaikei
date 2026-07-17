(() => {
  'use strict';

  const STORAGE_KEY = 'cdp-accounting-clean-v1';
  const status = document.getElementById('legacy-status');
  const exportButton = document.getElementById('export-legacy');
  const clearButton = document.getElementById('clear-legacy');

  function readLegacyValue() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_error) {
      return null;
    }
  }

  function updateStatus() {
    const value = readLegacyValue();
    const exists = typeof value === 'string' && value.length > 0;
    status.textContent = exists
      ? 'この端末に旧ブラウザ保存データがあります。先に書き出してください。'
      : 'この端末に救出対象の旧ブラウザ保存データはありません。';
    exportButton.disabled = !exists;
    clearButton.disabled = !exists;
  }

  exportButton.addEventListener('click', () => {
    const value = readLegacyValue();
    if (!value) {
      updateStatus();
      return;
    }

    let payload;
    try {
      payload = JSON.parse(value);
    } catch (_error) {
      payload = { raw: value, parseError: true };
    }

    const safeExport = {
      exportedAt: new Date().toISOString(),
      source: STORAGE_KEY,
      payload
    };
    const blob = new Blob([JSON.stringify(safeExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cdp-accounting-legacy-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status.textContent = '旧データを書き出しました。内容を確認してから端末データを削除してください。';
  });

  clearButton.addEventListener('click', () => {
    const confirmed = window.confirm('先にJSONを書き出し、内容を確認しましたか？ この端末の旧ブラウザ保存データを削除します。');
    if (!confirmed) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      updateStatus();
    } catch (_error) {
      status.textContent = '端末データを削除できませんでした。ブラウザ設定を確認してください。';
    }
  });

  updateStatus();
})();
