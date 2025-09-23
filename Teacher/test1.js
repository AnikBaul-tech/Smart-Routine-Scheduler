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

    const messages = [
      {
        name: "Shilpi Das",
        dept: "CSE",
        text: "Ma'am regarding the previous assignments I have some of the problems and so I want to meet you if you have any free time I can contact you please inform me Ma'am. If you will inform I will be thankful to you."
      },
      {
        name: "Ravi Kumar",
        dept: "ECE",
        text: "Ma'am I missed the last lecture due to illness. Could you please share the notes or guide me on what topics were covered?"
      },
      {
        name: "Ananya Roy",
        dept: "IT",
        text: "Ma'am I submitted the assignment but forgot to attach the code file. Can I resend it now?"
      }
    ];

let index = 0;

function updateMessage() {
    const info = document.getElementById("studentInfo");
    const text = document.getElementById("messageText");
    info.innerHTML = `Message from ${messages[index].name}<br>From ${messages[index].dept}`;
    text.textContent = messages[index].text;
}

function nextMessage() {
    index = (index + 1) % messages.length;
    updateMessage();
}

function prevMessage() {
    index = (index - 1 + messages.length) % messages.length;
    updateMessage();
}

updateMessage(); // Initial load