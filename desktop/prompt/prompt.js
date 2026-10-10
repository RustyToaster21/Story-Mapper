// Message and default value arrive in the query string; both are shown as plain text.
const params = new URLSearchParams(location.search);
const input = document.getElementById('value');

document.getElementById('message').textContent = params.get('message') ?? '';
input.value = params.get('value') ?? '';
input.focus();
input.select();

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  window.promptDialog.answer(input.value);
});
document.getElementById('cancel').addEventListener('click', () => window.promptDialog.answer(null));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.promptDialog.answer(null);
});
