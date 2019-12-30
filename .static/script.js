function reveal(elem, str) {
  if (elem.innerText != str) {
    elem.classList.remove('text-unrevealed');
    elem.innerText = str;
  }
}

const btnClipboardClasses = ['btn-info', 'btn-outline-info', 'btn-secondary', 'btn-outline-secondary', 'btn-danger', 'btn-outline-danger', 'btn-warning', 'btn-outline-warning', 'btn-light', 'btn-outline-light', 'btn-dark', 'btn-outline-dark'];
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

    for (const c of btnClipboardClasses) {
      if (elem.classList.contains(c)) {
        elem.setAttribute('data-class', c);
        elem.classList.remove(c);

        elem.classList.add('btn-success');

        break;
      }
    }

    // Set old text (delayed)
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

function updateRemainingChars(elem) {
  if (elem.hasAttribute('maxlength') && elem.hasAttribute('data-remaining')) {
    const target = document.getElementById(elem.getAttribute('data-remaining'));

    if (target) {
      if (!target.hasAttribute('data-orgHTML')) {
        target.setAttribute('data-orgHTML', target.innerHTML);
      }

      if (elem.value.length == 0 && target.hasAttribute('data-orgHTML')) {
        target.innerHTML = target.getAttribute('data-orgHTML');
      } else {
        target.innerText = elem.value.length + "/" + elem.getAttribute('maxlength');
      }
    }
  }
}

function toggleDarkMode(event) {
  if (event) {
    event.preventDefault();
  }

  const navMenu = document.getElementById('headerMenu'),
    footer = document.getElementById('footer'),
    body = document.getElementsByTagName('body').item(0);
  const tables = document.getElementsByClassName('table');

  const isCurrDarkMode = navMenu.classList.contains('bg-dark');

  if (isCurrDarkMode) {
    navMenu.classList.remove('navbar-dark', 'bg-dark');
    navMenu.classList.add('navbar-light', 'bg-light');

    footer.classList.remove('bg-dark');
    footer.classList.add('bg-light');

    body.classList.remove('dark-body', 'text-light');

    for (const table of tables) {
      table.classList.remove('table-dark');
    }
  } else {
    navMenu.classList.remove('navbar-light', 'bg-light');
    navMenu.classList.add('navbar-dark', 'bg-dark');

    footer.classList.remove('bg-light');
    footer.classList.add('bg-dark');

    body.classList.add('dark-body', 'text-light');

    for (const table of tables) {
      table.classList.add('table-dark');
    }
  }

  setActiveTheme(!isCurrDarkMode);
}

/**
 * @param {Boolean} darkTheme 
 */
function setActiveTheme(darkTheme) {
  document.cookie = `darkTheme=${darkTheme ? 1 : 0}; expires=${new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toUTCString()}; path=/`;
}