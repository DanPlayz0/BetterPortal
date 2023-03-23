(async function() {
    'use strict';
    function waitForElm(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // Speed up logins
    var landingPage = "assignment-center";
    if (window.location == "https://geffenacademy.myschoolapp.com/app#login"){
        window.location.replace("https://signin.blackbaud.com/signin/?redirectUrl=https:%2F%2Fgeffenacademy.myschoolapp.com%2Fapp%3Fbb_id%3D1%23studentmyday/" + landingPage);
    }

    let lastPagePath = null, lastPageHash = null;
    let pageUpdate = null, events = [];
    const portalContext = await fetch(`https://geffenacademy.myschoolapp.com/api/webapp/context?_=${Date.now()}`).then(res=>res.json());
    console.log(portalContext);
    setInterval(async () => {
        if (lastPagePath == window.location.pathname && lastPageHash == window.location.hash) return;
        lastPagePath = window.location.pathname;
        lastPageHash = window.location.hash;
        clearInterval(pageUpdate);
        events.map((x)=> document.body.removeEventListener(x[0], x[1]));
        events = [];

        if(lastPagePath == "/app/student" && lastPageHash == "#studentmyday/assignment-center") {
            await waitForElm("tbody#assignment-center-assignment-items>tr");
            let hiddenAssignments = JSON.parse(window.localStorage.getItem('betterportal-hidden-assignments') ?? "[]");
            pageUpdate = setInterval(() => {
                const assignments = [...document.querySelector("tbody#assignment-center-assignment-items").children];
                for(let elm of assignments) {
                    let assignmentId = elm.children[5].children[0].children[0].children[0].dataset.id,
                        [_,assignmentIndexId] = elm.children[2].children[0].href.replace(/^.+#/,'#').match(/#assignmentdetail\/\d+\/(\d+)/);
                    
                    // If assignment is hidden, remove it from the list
                    if (hiddenAssignments.some((x) => x.id == assignmentId)) {
                        elm.remove();
                        continue;
                    }

                    // Removes the red color for "Overdue" status
                    if (elm.children[5].innerText.includes("Overdue") && !elm.children[5].children[0].children[0].children[0].className.includes('betterportal-no-danger')) {
                        elm.children[5].children[0].children[0].children[0].classList.add('betterportal-no-danger');
                        elm.children[5].children[0].children[0].children[0].classList.remove('label-danger');
                    }

                    // Adds a button to hide the assignment
                    if (!elm.children[6].innerHTML.includes("betterportal-hide-assignment")) {
                        if(elm.children[6].innerText == "Submit") elm.children[6].innerHTML += `<br/>`;
                        elm.children[6].innerHTML += `${elm.children[6].innerHTML.includes("hide-assignment")?'<br/>':''}<button data-id="${assignmentId}" class="btn btn-link betterportal-hide-assignment" style="padding-left:0px;">Hide</button>`;
                    }
                    
                    // Make 

                    // Shows if there are saved notes for the assignment
                    const assignmentNotes = localStorage.getItem(`betterportal-si-${assignmentId}_${assignmentIndexId}`);
                    if (assignmentNotes && !elm.children[2].innerHTML.includes('betterportal-savednotes')) {
                        elm.children[2].innerHTML += `<p class="betterportal-savednotes" style="margin:-2px 0px 0px 0px; font-size:11px; color:#700">Has Saved Notes</p>`
                    }
                }
            }, 50);

            var clickEvent = document.createEvent("MouseEvents");
            clickEvent.initEvent("click", true, true);
            document.querySelector(`[data-sort="date_due"]`).dispatchEvent(clickEvent);

            const assignmentHeaderViewAdd = (prepend = true, html) => {
                if(!html) throw Error("No HTML Provided! (assignmentHeaderViewAdd)");
                const assignmentHeaderView = document.querySelector("#assignment-center-header-view .pull-right.assignment-calendar-button-bar");
                if (assignmentHeaderView) {
                    if(prepend) assignmentHeaderView.innerHTML = html + assignmentHeaderView.innerHTML;
                    else assignmentHeaderView.innerHTML += html;
                }
            };
            if (localStorage.getItem("betterportal-hidden-assignments")){
                assignmentHeaderViewAdd(true, `<button id="betterportal-unhide-all" class="btn btn-default btn-sm" data-toggle="modal"><i class="fa fa-eye"></i> Unhide All</button>`);
            }

            events.push(['click', (e) => {
                if(e.srcElement.className.includes("betterportal-hide-assignment")) {
                    hiddenAssignments.push({id:e.srcElement.parentElement.parentElement.children[5].children[0].children[0].children[0].dataset.id})
                    e.srcElement.parentElement.parentElement.remove();
                    window.localStorage.setItem("betterportal-hidden-assignments", JSON.stringify(hiddenAssignments))
                    if (!document.querySelector("#betterportal-unhide-all")){
                        assignmentHeaderViewAdd(true, `<button id="betterportal-unhide-all" class="btn btn-default btn-sm" data-toggle="modal"><i class="fa fa-eye"></i> Unhide All</button>`);
                    }
                } else if (e.srcElement.id == "betterportal-unhide-all"){
                    hiddenAssignments = [];
                    localStorage.removeItem("betterportal-hidden-assignments");
                    document.querySelector("#betterportal-unhide-all")?.remove();
                    window.location.reload(); // Todo, Make this not reload the page.
                }
            }]);
            const assignments = [...document.querySelector("tbody#assignment-center-assignment-items").children];
            console.log("Assignments Loaded!", assignments.length);
        } else if (lastPagePath == "/app/student" && lastPageHash.startsWith("#assignmentdetail/")) {
            await waitForElm("div#assignment-detail-assignment .bb-tile-content-section");
            const [_,assignmentId,assignmentIndexId] = lastPageHash.match(/#assignmentdetail\/(\d+)\/(\d+)/);
            if(!document.querySelector("#betterportal-text-content")) {
                document.querySelector("#assignment-detail-assignment .bb-tile-content-section").innerHTML += `<div id="betterportal-text-content">
  <div class="well well-sm" style="margin:10px 0px 5px 0px">
    <h3>Saved Notes</h3>
    <textarea id="betterportal-savedinfo" style="min-height:100px;width:100%;resize:vertical;"></textarea>
  </div>
</div>`;
            }
            document.querySelector("#betterportal-text-content textarea").value = localStorage.getItem(`betterportal-si-${assignmentId}_${assignmentIndexId}`) ?? "";
            let currentAssignmentText = localStorage.getItem(`betterportal-si-${assignmentId}_${assignmentIndexId}`) ?? "";
            events.push(['input', (e) => {
                if(e.srcElement.id == "betterportal-savedinfo") {
                    if (e.srcElement.value.length == 0) localStorage.removeItem(`betterportal-si-${assignmentId}_${assignmentIndexId}`);
                    else localStorage.setItem(`betterportal-si-${assignmentId}_${assignmentIndexId}`, e.srcElement.value);
                }
            }])
        }
        events.map((x)=> document.body.addEventListener(x[0], x[1]));
    }, 25);
})();
