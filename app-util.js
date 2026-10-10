const msgBox = document.getElementById("quiz-box");
const msgPrompt = document.getElementById('prompt');
const subMsgPrompt = document.getElementById('score');
const nextButton = document.getElementById('next-btn');
const continentFilter = document.getElementById('filter-cont');
const tagFilter = document.getElementById('filter-tag');

export function showMsgBox() {
    msgBox.style.display = 'block';
}

export function hideMsgBox() {
    msgBox.style.display = 'none';
    document.getElementById("quiz-box").style.display = 'none';
}

export function setMsg(msg, subMsg=null) {
    msgPrompt.innerText = msg;
    if(!subMsg) {
        subMsgPrompt.display = 'none';
    } else {
        subMsgPrompt.display = 'block';
        subMsgPrompt.innerText = subMsg;
    }
}

export function showNextBtn() {
    nextButton.style.display = 'block';
}

export function hideNextBtn() {
    nextButton.style.display = 'none';
}

export function getFilters() {
    let checkedBoxes = continentFilter.querySelectorAll('input:checked');
    // Converts to array of the stored html values
    const checkedContinents = Array.from(checkedBoxes).map(box => box.value);

    checkedBoxes = tagFilter.querySelectorAll('input:checked');
    // Converts to array of the stored html values
    const checkedTags = Array.from(checkedBoxes).map(box => box.value);

    return {
        continents: checkedContinents,
        tags: checkedTags,
    }
}

export function getLocationFromEvent(event) {
    return event.target.options.location;
}