// Content script for extracting page content
(() => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractPage') {
      const title = document.title || 'Untitled Page';
      const url = window.location.href;

      // Clean text extraction
      const articleHeading = document.querySelector('h1')?.innerText || title;
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText.trim())
        .filter(t => t.length > 20);

      const markdown = `# ${articleHeading}\n\n**Source URL**: [${url}](${url})\n\n## Content\n\n${paragraphs.join('\n\n')}`;

      sendResponse({
        title,
        url,
        markdown
      });
    }
    return true;
  });
})();
