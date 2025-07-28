hljs.highlightAll();
const editor = document.getElementById('editor');

const inlineStyleMap = [
    { regex: /\*\*(.*?)\*\*/, className: 'bold' },
    { regex: /\*(.*?)\*/, className: 'italic' },
    { regex: /_(.*?)_/, className: 'italic' },
    { regex: /~~(.*?)~~/, className: 'strikethrough' },
    { regex: /__(.*?)__/, className: 'underline' },
    { regex: /==(.*?)==/, className: 'highlight' },
    { regex: /`(.*?)`/, className: 'inline-code' },
    {
        regex: /\[(.*?)\]\((.*?)\)/,
        className: 'link',
        isLink: true
    }
];
function createHashID(timeStamp = new Date()) {
    const headingLevel = typeof timeStamp === 'number' ? timeStamp : 1;
    const safeLevel = Math.min(6, Math.max(1, headingLevel));
    const hexId = timeStamp.getTime().toString(16);
    return `${hexId}_${safeLevel}`;
}
function createNewSection(headingLevel = 1, id) {
    return `
        <section id="section_${id}" contenteditable="true" data-slate-node="element">
            <h${headingLevel} data-slate-node="element">
                <span data-slate-node="text">
                    <span data-slate-leaf="true">&#8288;</span>
                </span>
            </h${headingLevel}>
            ${createParagraph()}
        </section>
    `;
}

function createParagraph(hexID) {
    return `
        <p id="paragraph_${hexID}" data-slate-node="element">
            <span data-slate-node="text">
                <span data-slate-leaf="true">&#8288;</span>
            </span>
        </p>
    `;
}


function formatBlockStyles(leafSpan, text) {
  if (text.match(/^(#{1,6})\s/)) {
    const headingMatch = text.match(/^(#{1,6})\s/);
    if (!headingMatch) return;

    const hashes = headingMatch[1];
    const headingLevel = hashes.length;
    const parentP = leafSpan.closest('p[data-slate-node="element"]');
    const currentSection = parentP.closest('section');

    const cleanedText = leafSpan.textContent
      .replace(/\u200B/g, '')
      .replace(headingMatch[0], ''); // Remove full match including space
    leafSpan.textContent = cleanedText; // Update the leaf span text
    const hexId = createHashID();
    const newSectionNode = createNewSection(headingLevel, hexId);

    let newHeadingLeaf = null;
    let newHeadingSpan = null;

    if (editor.children.length === 1 && editor.firstElementChild === currentSection) {
      currentSection.outerHTML = newSectionNode;
      const updatedSection = editor.querySelector(`#section_${hexId}`);
      newHeadingSpan = updatedSection.querySelector(`h${headingLevel} > span`);
    } else {
      editor.insertAdjacentHTML('beforeend', newSectionNode);
      const lastSection = editor.querySelector('section:last-of-type');
      newHeadingSpan = lastSection.querySelector(`h${headingLevel} > span`);
    }

    if (newHeadingSpan) {
      // Apply inline formatting to the new <h*> span
      newHeadingSpan.innerHTML = ''; // Clear placeholder
      newHeadingSpan.textContent = cleanedText;
      formatInlineStyles(newHeadingSpan);

      // Move cursor to the end
      const newLeaf = newHeadingSpan.querySelector('span[data-slate-leaf="true"]');
      if (newLeaf) {
        const range = document.createRange();
        range.selectNodeContents(newLeaf);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }
}





function formatInlineStyles(hElement) {
    const rawText = hElement.innerText;
    let remaining = rawText;
    hElement.innerHTML = '';
    let addedAny = false;
    while (remaining.length > 0) {
        let matched = false;
        for (const { regex, className, isLink } of inlineStyleMap) {
            const match = remaining.match(regex);
            if (match) {
                matched = true;
                const before = remaining.slice(0, match.index);
                if (before) {
                    hElement.appendChild(makeTextSpan(before));
                    hElement.appendChild(makeSpacer());
                    addedAny = true;
                }
                const styledText = match[1];
                const span = document.createElement('span');
                span.setAttribute('data-slate-node', 'text');
                if (className) span.classList.add(className);
                const inner = document.createElement('span');
                inner.setAttribute('data-slate-leaf', 'true');
                if (isLink) {
                    const a = document.createElement('a');
                    a.href = match[2];
                    a.target = "_blank";
                    a.textContent = styledText;
                    inner.appendChild(a);
                } else {
                    inner.textContent = styledText;
                }
                span.appendChild(inner);
                hElement.appendChild(span);
                hElement.appendChild(makeSpacer());
                remaining = remaining.slice(match.index + match[0].length);
                addedAny = true;
                break;
            }
        }
        if (!matched) {
            if (remaining.trim() !== '') {
                hElement.appendChild(makeTextSpan(remaining));
                addedAny = true;
            }
            break;
        }
    }
    if (!addedAny) {
        const empty = makeTextSpan('\u200B');
        hElement.appendChild(empty);
    }
}

function makeTextSpan(text) {
    const span = document.createElement('span');
    span.setAttribute('data-slate-node', 'text');
    const inner = document.createElement('span');
    inner.setAttribute('data-slate-leaf', 'true');
    inner.textContent = text;
    span.appendChild(inner);
    return span;
}

function makeSpacer() {
    const span = document.createElement('span');
    span.setAttribute('data-slate-node', 'text');
    const inner = document.createElement('span');
    inner.setAttribute('data-slate-leaf', 'true');
    inner.innerHTML = '&nbsp;';
    span.appendChild(inner);
    return span;
}


editor.addEventListener('input', (event) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const node = selection.anchorNode;
    const element = node?.nodeType === 3 ? node.parentElement : node;
    const advertElement = document.querySelector('[data-slate-advertisement]');
    if (advertElement) {
        advertElement.parentElement.setAttribute('contenteditable', 'true');
        advertElement.remove();
    }
    if (element?.dataset?.slateLeaf === "true") {
        const cleanText = element.textContent.replace(/\u200B/g, '');
        const blockParent = element.closest('p, h1, h2, h3, h4, h5, h6');
        if (!blockParent) return;
        if (blockParent.tagName === 'P') {
            formatBlockStyles(element, cleanText);
            console.log("in p tag")
        }        
    }
});

editor.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const node = selection.anchorNode;
        const leafSpan = node?.nodeType === 3 ? node.parentElement : node;
        if (!leafSpan || !leafSpan.closest('[data-slate-leaf="true"]')) return;
        event.preventDefault();
        const currentP = leafSpan.closest('p[data-slate-node="element"]');
        const currentSection = leafSpan.closest('section');
        if (currentSection) {
            const hexID = createHashID();
            const newParagraph = createParagraph(hexID);
            const temp = document.createElement('div');
            temp.innerHTML = newParagraph;
            const newP = temp.firstElementChild;
            currentSection.insertBefore(newP, currentP?.nextSibling || null);

            const newLeaf = newP.querySelector('span[data-slate-leaf="true"]');
            if (newLeaf) {
                const range = document.createRange();
                range.selectNodeContents(newLeaf);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
        }
            }
                }

});


editor.addEventListener('keydown', (event) => {
    if (event.key !== 'Backspace') return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;
    const anchorOffset = selection.anchorOffset;

    const leafSpan = anchorNode?.nodeType === 3 ? anchorNode.parentElement : anchorNode;
    const isInsideLeaf = leafSpan?.closest('[data-slate-leaf="true"]');

    if (isInsideLeaf) return;

    event.preventDefault();

    const validLeaf = editor.querySelector('span[data-slate-leaf="true"]');

    if (validLeaf) {
        const range = document.createRange();
        range.selectNodeContents(validLeaf);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
    }

    const newSpan = document.createElement('span');
    newSpan.setAttribute('data-slate-leaf', 'true');
    newSpan.innerHTML = '&#8288;'; 

    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-slate-node', 'text');
    wrapper.appendChild(newSpan);

    
    const lastSection = editor.querySelector('section:last-of-type');
    const targetBlock = lastSection || editor;

    
    const block = targetBlock.querySelector('[data-slate-node="element"]') ||
                  targetBlock.querySelector('h1, h2, h3, h4, h5, h6') ||
                  targetBlock;

    block.appendChild(wrapper);

    
    const newRange = document.createRange();
    newRange.selectNodeContents(newSpan);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
});
