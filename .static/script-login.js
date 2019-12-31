const BASE_URL = 'https://mc-auth.com';

async function submitUsername(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('submitBtn'),
    nameInput = document.getElementById('mcName');

  submitBtn.classList.add('disabled');
  nameInput.classList.add('disabled');
  submitBtn.setAttribute('disabled', 'disabled');
  nameInput.setAttribute('disabled', 'disabled');

  try {
    const res = await fetch(`https://api.sprax2013.de/mojang/profile/${nameInput.value}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.status === 200) {
      const json = await res.json();

      event.target.onsubmit = submitCode;

      nameInput.setAttribute('data-mcUUID', json.id);
      document.getElementById('otp').setAttribute('required', 'required');
      document.getElementById('form2').classList.remove('hidden');

      submitBtn.classList.remove('disabled');
      submitBtn.removeAttribute('disabled');

      console.log('Valid Username:', json.name);
    } else {
      console.error('That username does not exist!');

      submitBtn.classList.remove('disabled');
      submitBtn.removeAttribute('disabled');

      nameInput.classList.remove('disabled');
      nameInput.removeAttribute('disabled');
    }
  } catch (err) {
    console.error('Request failed - Sending form to server instead!', err);

    event.target.onsubmit = undefined;
    event.target.submit();
  }
}

async function submitCode(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('submitBtn'),
    mcUUID = document.getElementById('mcName').getAttribute('data-mcUUID'),
    codeInput = document.getElementById('otp');

  submitBtn.classList.add('disabled');
  codeInput.classList.add('disabled');
  submitBtn.setAttribute('disabled', 'disabled');
  codeInput.setAttribute('disabled', 'disabled');

  try {
    const res = await fetch(`${BASE_URL}/login/verify?uuid=${mcUUID}&otp=${codeInput.value}&keepLogin=${document.getElementById('keepLogin').checked}&returnTo=${event.target.getAttribute('data-returnTo')}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.status == 200) {
      const json = await res.json();

      console.log('Login was successful!');
      window.location.href = json.url || BASE_URL;
    } else {
      console.error('The code is invalid!');

      submitBtn.classList.remove('disabled');
      submitBtn.removeAttribute('disabled');

      codeInput.classList.remove('disabled');
      codeInput.removeAttribute('disabled');
    }
  } catch (err) {
    console.error('Request failed - Sending form to server instead!', err);

    event.target.onsubmit = undefined;
    event.target.submit();
  }
}