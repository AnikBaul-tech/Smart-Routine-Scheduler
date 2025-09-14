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
