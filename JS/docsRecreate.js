

hljs.highlightAll();
const editor = document.getElementById('editor');

const inlineStyleMap = [
  {
    regex: /(^|\s)\*\*(?!\s)(.+?)(?<!\s)\*\*(?=\s|$)/, 
    className: 'bold'
  },
  {
    regex: /(^|\s)\*(?!\s)([^*]+?)(?<!\s)\*(?=\s|$)/,  
    className: 'italic'
  },
  {
    regex: /(^|\s)_(?!\s)([^_]+?)(?<!\s)_(?=\s|$)/,   
    className: 'italic'
  },
  {
    regex: /(^|\s)~~(?!\s)(.+?)(?<!\s)~~(?=\s|$)/,     
    className: 'strikethrough'
  },
  {
    regex: /(^|\s)__(?!\s)(.+?)(?<!\s)__(?=\s|$)/,      
    className: 'underline'
  },
  {
    regex: /(^|\s)==(?!\s)(.+?)(?<!\s)==(?=\s|$)/,      
    className: 'highlight'
  },
  {
    regex: /(^|\s)`(?!\s)(.+?)(?<!\s)`(?=\s|$)/,       
    className: 'inline_code'
  },
  {
    regex: /(^|\s)\[(.+?)\]\((.+?)\)(?=\s|$)/,          
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
  const headingRegex = /^\u2060*(#{1,6})[\u00A0\s]/;
  const headingMatch = text.match(headingRegex);

  if (!headingMatch) return;

  console.log("Heading detected");
  const hashes = headingMatch[1];
  const headingLevel = hashes.length;

  const parentP = leafSpan.closest('p[data-slate-node="element"]');
  const currentSection = parentP?.closest('section');
  if (!currentSection) return;

  // Remove invisible characters and heading markdown
  const cleanedText = leafSpan.textContent
    .replace(/\u2060/g, '')              // Remove WORD JOINER
    .replace(headingRegex, '');          // Remove heading pattern
  leafSpan.textContent = cleanedText;

  const hexId = createHashID();
  const newSectionNode = createNewSection(headingLevel, hexId);

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
    newHeadingSpan.innerHTML = ''; // Clear placeholder
    newHeadingSpan.textContent = cleanedText;
    formatInlineStyles(newHeadingSpan);

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

function createSpanAndInsert(blockParent, text, className, isFirst = false) {
    text = text.replace(/\u200B/g, '').trim(); // clean up input
    const hexID = createHashID();

    const leftSpacer = `
        <span id="left_spacer_inline_${hexID}" data-slate-node="text">
            <span data-slate-leaf="true">&nbsp; </span>
        </span>`;

    const rightSpacer = `
        <span id="right_spacer_inline_${hexID}" data-slate-node="text">
            <span data-slate-leaf="true">&nbsp; </span>
        </span>`;

    const styledSpan = `
        <span id="inline_${hexID}" data-slate-node="text" ${className ? `class="${className}"` : ''}>
            <span data-slate-leaf="true">${text}</span>
        </span>`;

    // Insert spans in the right order
    if (isFirst) {
        blockParent.insertAdjacentHTML('beforeend', leftSpacer);
    }

    blockParent.insertAdjacentHTML('beforeend', styledSpan);
    blockParent.insertAdjacentHTML('beforeend', rightSpacer);

    // Set caret inside right spacer
    const newSpan = blockParent.querySelector(`#right_spacer_inline_${hexID}`);
    if (newSpan) {
        const range = document.createRange();
        range.selectNodeContents(newSpan);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
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
    const rawText = element.textContent;
    const cleanText = rawText.replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
    const blockParent = element.closest('p, h1, h2, h3, h4, h5, h6');
    if (!blockParent) return;

    if ((blockParent.tagName === 'P') || blockParent.tagName === 'H1' || blockParent.tagName === 'H2' || blockParent.tagName === 'H3' || blockParent.tagName === 'H4' || blockParent.tagName === 'H5' || blockParent.tagName === 'H6') {
        for (const { regex, className, isLink } of inlineStyleMap) {
        const match = cleanText.match(regex);
        if (match) {
            event.preventDefault();

            const fullMatch = match[0];
            let matchedText = match[2].trim();
            matchedText = matchedText.replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
            const matchStart = cleanText.indexOf(fullMatch);
            const matchEnd = matchStart + fullMatch.length;

            const beforeText = cleanText.slice(0, matchStart);
            const afterText = cleanText.slice(matchEnd);

            
            element.textContent = ' '; 

            
            if (beforeText.trim()) createSpanAndInsert(blockParent, beforeText, null);
            isFirstElement = element === blockParent.firstElementChild;
            if(isFirstElement)
            {
                createSpanAndInsert(blockParent, matchedText, className, true);
            }
            else 
            {
                createSpanAndInsert(blockParent, matchedText, className);
            }
            
            if (afterText.trim()) createSpanAndInsert(blockParent, afterText, null);

            break; 
        }
        }


      formatBlockStyles(element, cleanText);
      console.log("in p tag");
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
