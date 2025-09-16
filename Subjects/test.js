function setProgress(percent) {
    const arcLength = 330; // measured arc length
    const progressBar = document.querySelector(".progress-bar");
    const text = document.querySelector(".progress-text");

    // progress from left → right
    const offset = arcLength - (arcLength * percent / 100);
    progressBar.style.strokeDashoffset = offset;

    // animate number
    let current = 0;
    const step = Math.max(1, Math.ceil(percent / 30));
    const interval = setInterval(() => {
    if (current >= percent) {
        clearInterval(interval);
        current = percent;
    }

    text.innerHTML = `${current} %<br><span id="sub-progress-text">Over all Syllabus<br>Completed<span>`;
    current += step;
    }, 30);
}

// Example: Animate to 75%
setTimeout(() => setProgress(50), 500);