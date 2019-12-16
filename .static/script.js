function reveal(elem, str) {
  elem.classList.remove('text-unrevealed');
  elem.innerText = str;
}

function copyToClipboard(elem, str) {
  const tempElem = document.createElement('textarea');
  tempElem.style.position = 'absolute';
  tempElem.style.left = '-100vw';
  tempElem.setAttribute('readonly', '');
  tempElem.value = str;
  document.body.appendChild(tempElem);

  const selected = document.getSelection().rangeCount > 0
    ? document.getSelection().getRangeAt(0)
    : false;

  tempElem.select();
  document.execCommand('copy');
  document.body.removeChild(tempElem);

  if (selected) {
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(selected);
  }

  if (!elem.hasAttribute('data-orgHTML')) {
    elem.setAttribute('data-orgHTML', elem.innerHTML);
    elem.innerHTML = elem.innerHTML == '<i class="far fa-clipboard"></i>' ? '<i class="far fa-check-circle"></i>' : 'Copied!';

    if (elem.classList.contains('btn-info')) {
      elem.setAttribute('data-class', 'btn-info');
      elem.classList.remove('btn-info');

      elem.classList.add('btn-success');
    } else if (elem.classList.contains('btn-outline-info')) {
      elem.setAttribute('data-class', 'btn-outline-info');
      elem.classList.remove('btn-outline-info');

      elem.classList.add('btn-outline-success');
    }

    setTimeout(() => {
      elem.innerHTML = elem.getAttribute('data-orgHTML');
      elem.removeAttribute('data-orgHTML');

      if (elem.hasAttribute('data-class')) {
        elem.classList.remove('btn-success', 'btn-outline-success');
        elem.classList.add(elem.getAttribute('data-class'));

        elem.removeAttribute('data-class');
      }

    }, 1000);
  }
}