document.addEventListener('DOMContentLoaded', async () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const apiTokenInput = document.getElementById('apiToken');
  const projectIdSelect = document.getElementById('projectId');
  const clipBtn = document.getElementById('clipBtn');
  const statusDiv = document.getElementById('status');

  // Restore settings
  chrome.storage.local.get(['serverUrl', 'apiToken'], (res) => {
    if (res.serverUrl) serverUrlInput.value = res.serverUrl;
    if (res.apiToken) apiTokenInput.value = res.apiToken;
  });

  serverUrlInput.addEventListener('change', () => {
    chrome.storage.local.set({ serverUrl: serverUrlInput.value });
  });

  apiTokenInput.addEventListener('change', () => {
    chrome.storage.local.set({ apiToken: apiTokenInput.value });
  });

  clipBtn.addEventListener('click', async () => {
    statusDiv.textContent = 'Extracting page content...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusDiv.textContent = 'Error: Active tab not found.';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'extractPage' }, async (pageData) => {
      if (!pageData) {
        statusDiv.textContent = 'Error: Failed to extract page content.';
        return;
      }

      statusDiv.textContent = 'Sending to Wiki-Forge...';

      const serverUrl = serverUrlInput.value.replace(/\/+$/, '');
      const apiToken = apiTokenInput.value.trim();
      const projectId = projectIdSelect.value;
      const fileName = `${pageData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;

      try {
        const headers = {
          'Content-Type': 'application/json',
          'X-Project-Id': projectId,
        };
        if (apiToken) {
          headers['X-WikiForge-Token'] = apiToken;
        }

        const res = await fetch(`${serverUrl}/api/wiki/upload`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            folderPath: 'sources/web-clips',
            fileName,
            content: pageData.markdown
          })
        });

        if (res.ok) {
          statusDiv.textContent = `✅ Successfully clipped "${pageData.title}"!`;
        } else {
          const errData = await res.json().catch(() => ({}));
          statusDiv.textContent = `❌ Upload failed: ${errData.error || res.statusText}`;
        }
      } catch (err) {
        statusDiv.textContent = `❌ Network error: ${err.message}`;
      }
    });
  });
});
