const toggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const three_dots = document.querySelector('.menu-toggle');
  three_dots.style.color = 'rgb(11, 16, 86)';
  let three_dots_clicked = false;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    three_dots.style.color = 'white';
    three_dots_clicked = !three_dots_clicked;
    if (three_dots_clicked) {
        three_dots.style.color = 'white';
    } else {
        three_dots.style.color = 'rgb(11, 16, 86)';
    }
});

function setProgress(percent) {
    const arcLength = 330; // measured arc length
    const progressBar = document.querySelector(".progress-bar");
    const text = document.getElementById("progress-text");

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

    text.innerHTML = `${current} %<br><span id="sub-progress-text">Syllabus<br>Completed<span>`;
    current += step;
    }, 30);
}

// Example: Animate to 75%
setTimeout(() => setProgress(50), 500);

function setProgressAttendance(percent) {
    const progressBar = document.getElementById("progress-bar");
    const text = document.querySelector(".attendance-progress-text");
    progressBar.style.width = percent + "%";

    if (percent < 30) {
        progressBar.style.background = "var(--red)";
    } else {
        progressBar.style.background = "var(--green)";
    }

    // Animate number
    let current = 0;
    const step = Math.max(1, Math.ceil(percent / 30));
    const interval = setInterval(() => {
        current += step;
        if (current >= percent) {
            current = percent; // clamp to final value
            clearInterval(interval);
        }
        text.innerHTML = `${current}%<br>`;
    }, 30);
}

// Example: change this value to test
setTimeout(() => setProgressAttendance(70),800);  // try 10, 25, 70 etc