// Generator webview script — loaded with nonce, no inline scripts
(function () {
  const vscode = acquireVsCodeApi();

  const nameInput = document.getElementById('name');
  const directoryInput = document.getElementById('directory');
  const extraArgsInput = document.getElementById('extraArgs');
  const generatorSelect = document.getElementById('generator');
  const generatorDescription = document.getElementById('generatorDescription');
  const dryRunBtn = document.getElementById('dryRunBtn');
  const generateBtn = document.getElementById('generateBtn');
  const outputDiv = document.getElementById('output');

  // Dart identifier validation: lowercase, digits, underscores
  const dartIdentifierRegex = /^[a-z][a-z0-9_]*$/;

  function updateDescription() {
    const selected = generatorSelect.options[generatorSelect.selectedIndex];
    const desc = selected ? selected.dataset.description : '';
    generatorDescription.textContent = desc || '';
  }

  generatorSelect.addEventListener('change', updateDescription);
  updateDescription();

  function getValues() {
    return {
      generator: generatorSelect.value,
      name: nameInput.value.trim(),
      directory: directoryInput.value.trim() || undefined,
      extraArgs: extraArgsInput.value.trim() || undefined,
    };
  }

  function validateName(name) {
    if (!name) return 'Project name is required';
    if (!dartIdentifierRegex.test(name)) {
      return 'Must be a valid Dart identifier: lowercase letters, digits, and underscores. Must start with a letter.';
    }
    return null;
  }

  function showOutput(text, type) {
    outputDiv.textContent = text;
    outputDiv.className = 'output ' + (type || '');
    outputDiv.hidden = false;
  }

  function clearValidation() {
    const existing = document.querySelector('.validation-error');
    if (existing) existing.remove();
  }

  function showValidation(message) {
    clearValidation();
    const div = document.createElement('div');
    div.className = 'validation-error';
    div.textContent = message;
    nameInput.parentNode.appendChild(div);
  }

  dryRunBtn.addEventListener('click', () => {
    const { generator, name, directory } = getValues();
    const error = validateName(name);
    if (error) {
      showValidation(error);
      return;
    }
    clearValidation();
    showOutput('Running dry run...', '');
    vscode.postMessage({ type: 'dryRun', generator, name, directory, extraArgs: getValues().extraArgs });
  });

  generateBtn.addEventListener('click', () => {
    const { generator, name, directory } = getValues();
    const error = validateName(name);
    if (error) {
      showValidation(error);
      return;
    }
    clearValidation();
    showOutput('Generating...', '');
    vscode.postMessage({ type: 'generate', generator, name, directory, extraArgs: getValues().extraArgs });
  });

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'dryRunResult':
        showOutput(message.output, message.output.startsWith('Error') ? 'error' : '');
        break;
      case 'generateResult':
        showOutput(
          message.output,
          message.output.startsWith('Error') ? 'error' : 'success'
        );
        break;
    }
  });
})();
