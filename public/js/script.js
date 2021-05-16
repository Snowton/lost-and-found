var prevScrollpos = window.pageYOffset;
window.onscroll = scrollShowNav;

function scrollShowNav() {
    var currentScrollPos = window.pageYOffset;
    if (prevScrollpos > currentScrollPos) {
        document.getElementsByTagName("header")[0].style.top = "0px";
    } else {
        document.getElementsByTagName("header")[0].style.top = "-55px";
    }
    prevScrollpos = currentScrollPos;
}