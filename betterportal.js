(async function () {
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

    let lastPagePath = null, lastPageHash = null;
    let pageUpdate = null, events = [];
    let portalContext = null;
    const settings = {
        "sortby": "date_due", // none, groupname, assignment_type, short_description, date_assigned, date_due, assignment_status
        "sortdir": "asc", // asc, des
        "showbuttons": true,
        "overduecolor": null, // none, hexcode (e.g. #ff0000)
        
        "savednotes": true,
        "classlinks": true,
    }

    let settingsCache = new (class SettingsCache extends Map {
        constructor() {
            super();
            this.expires = new Map();
        }
        get(key) {
            const expires = this.expires;
            if (super.has(key) && expires.get(key) > Date.now()) return super.get(key);
            if (!chrome.hasOwnProperty('storage')) return settings[key];
            return new Promise((resolve) => {
                chrome.storage.sync.get(key, (items) => {
                    super.set(key, items[key]);
                    expires.set(key,Date.now()+1000*15);
                    resolve(items[key]);
                });
            });
        }
    })
    let getSetting = (key) => settingsCache.get(key);
    let bpData = {
        set(key, value, json = false) {
            localStorage.setItem(key, json ? JSON.stringify(value) : value);
            return value;
        },
        get(key, defaultValue = null, json = false) {
            return (localStorage.getItem(key) ? (json ? JSON.parse(localStorage.getItem(key)) : localStorage.getItem(key)) : null) ?? defaultValue;
        },
        has(key) {
            if (localStorage.getItem(key)) return true;
            return false;
        },
        remove(key) {
            localStorage.removeItem(key);
        }
    }
    setInterval(async () => {
        if (lastPagePath == window.location.pathname && lastPageHash == window.location.hash) return;
        lastPagePath = window.location.pathname;
        lastPageHash = window.location.hash;
        clearInterval(pageUpdate);
        events.map((x) => document.body.removeEventListener(x[0], x[1]));
        events = [];
        if (portalContext == null && lastPagePath != "/app" && lastPageHash != "#login") portalContext = await fetch(`https://geffenacademy.myschoolapp.com/api/webapp/context?_=${Date.now()}`).then(res => res.json());

        if (lastPagePath == "/app/student" && lastPageHash == "#studentmyday/assignment-center") {
            await waitForElm("tbody#assignment-center-assignment-items>tr");
            let hiddenAssignments = bpData.get("betterportal-hidden-assignments", [], true);
            let pinnedAssignments = bpData.get("betterportal-pinned-assignments", [], true);
            pageUpdate = setInterval(async () => {
                const assignments = [...document.querySelector("tbody#assignment-center-assignment-items").children];
                for (let elm of assignments) {
                    if (elm.children[1].innerText == "My tasks") continue;
                    if (elm.children[2].innerText.includes('Assessment')) continue;
                    let assignmentId = elm.children[5].children[0].children[0].children[0].dataset.id,
                        [_, assignmentIndexId] = elm.children[2].children[0].href.replace(/^.+#/, '#').match(/#assignmentdetail\/\d+\/(\d+)/);

                    // Hide Assignment (Function)
                    if (hiddenAssignments.includes(assignmentId)) {
                        elm.remove();
                        continue;
                    }

                    // No "Overdue" Red
                    let overdueColor = await getSetting("overduecolor");
                    if (overdueColor) {
                        if (elm.children[5].innerText.includes("Overdue") && !elm.children[5].children[0].children[0].children[0].className.includes('betterportal-overdue')) {
                            elm.children[5].children[0].children[0].children[0].classList.add('betterportal-overdue');
                            elm.children[5].children[0].children[0].children[0].style = `background-color: ${overdueColor} !important;`;
                            elm.children[5].children[0].children[0].children[0].classList.remove('label-danger');
                        }
                    }

                    // Hide Assignment (Button)
                    let showButtons = await getSetting("showbuttons");
                    if (showButtons) {
                        if (!elm.children[6].innerHTML.includes("betterportal-hide-assignment")) {
                            if (elm.children[6].innerText == "Submit") elm.children[6].innerHTML += `<br/>`;
                            elm.children[6].innerHTML += `<button data-id="${assignmentId}" class="btn btn-link betterportal-hide-assignment" style="padding-left:0px;">Hide</button>`;
                        }
                    }

                    // Pin Assignment (Button)
                    if (showButtons) {
                        if (!elm.children[6].innerHTML.includes("betterportal-pin-assignment") && !elm.children[6].innerHTML.includes("betterportal-unpin-assignment")) {
                            let isPinned = pinnedAssignments.some(x => x.id == assignmentId);
                            if (isPinned) elm.children[6].innerHTML += `<button data-id="${assignmentId}" class="btn btn-link betterportal-unpin-assignment" style="margin-left:10px;">Unpin</button>`;
                            else elm.children[6].innerHTML += `<button data-id="${assignmentId}" class="btn btn-link betterportal-pin-assignment" style="margin-left:10px;">Pin</button>`;
                        }
                    }

                    // Clickable "Graded"
                    if (elm.children[5].innerText.includes("Graded") && !elm.children[5].children[0].children[0].children[0].className.includes('betterportal-graded-clickable')) {
                        elm.children[5].children[0].children[0].children[0].classList.add('betterportal-graded-clickable');
                    }


                    // Has Saved Notes
                    let savedNotesHtml = `<p class="betterportal-savednotes" style="margin:-2px 0px 0px 0px; font-size:11px; color:#700">Has Saved Notes</p>`;
                    if (bpData.has(`betterportal-si-${assignmentId}_${assignmentIndexId}`) && !elm.children[2].innerHTML.includes('betterportal-savednotes')) {
                        elm.children[2].innerHTML += savedNotesHtml;
                    } else if (!bpData.has(`betterportal-si-${assignmentId}_${assignmentIndexId}`) && elm.children[2].innerHTML.includes('betterportal-savednotes')) {
                        elm.children[2].innerHTML = elm.children[2].innerHTML.replace(savedNotesHtml, '');
                    }
                }
            }, 50);

            if ((await getSetting("sortby")) != 'none') {
                await waitForElm(`a[data-sort="${await getSetting("sortby")}"]`);
                let clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
                document.querySelector(`a[data-sort="${await getSetting("sortby")}"]`).dispatchEvent(clickEvent);
                if ((await getSetting("sortdir")) == "des") document.querySelector(`a[data-sort="${await getSetting("sortby")}"]`).dispatchEvent(clickEvent);
            }

            const assignmentHeaderViewAdd = (prepend = true, html) => {
                if (!html) throw Error("No HTML Provided! (assignmentHeaderViewAdd)");
                const assignmentHeaderView = document.querySelector("#assignment-center-header-view .pull-right.assignment-calendar-button-bar");
                if (assignmentHeaderView) {
                    if (prepend) assignmentHeaderView.innerHTML = html + assignmentHeaderView.innerHTML;
                    else assignmentHeaderView.innerHTML += html;
                }
            };
            if (bpData.has("betterportal-hidden-assignments")) {
                assignmentHeaderViewAdd(true, `<button id="betterportal-unhide-all" class="btn btn-default btn-sm" data-toggle="modal"><i class="fa fa-eye"></i> Unhide All</button>`);
            }

            events.push(['click', (e) => {
                if (e.srcElement.className.includes("betterportal-hide-assignment")) {
                    hiddenAssignments.push(e.srcElement.dataset.id);
                    e.srcElement.parentElement.parentElement.remove();
                    bpData.set("betterportal-hidden-assignments", hiddenAssignments, true)
                    if (!document.querySelector("#betterportal-unhide-all")) {
                        assignmentHeaderViewAdd(true, `<button id="betterportal-unhide-all" class="btn btn-default btn-sm" data-toggle="modal"><i class="fa fa-eye"></i> Unhide All</button>`);
                    }
                } else if (e.srcElement.id == "betterportal-unhide-all") {
                    hiddenAssignments = [];
                    bpData.remove("betterportal-hidden-assignments");
                    document.querySelector("#betterportal-unhide-all")?.remove();
                    window.location.reload(); // Todo, Make this not reload the page.
                } else if (e.srcElement.className.includes("betterportal-pin-assignment")) {
                    let assignmentElm = e.srcElement.parentElement.parentElement;
                    assignmentElm.children[6].innerHTML = assignmentElm.children[6].innerHTML.replace("betterportal-pin-assignment", "betterportal-unpin-assignment").replace("Pin", "Unpin");
                    pinnedAssignments.push({
                        id: e.srcElement.dataset.id,
                        link: assignmentElm.children[2].children[0].href,
                    });
                    bpData.set("betterportal-pinned-assignments", pinnedAssignments, true);
                } else if (e.srcElement.className.includes("betterportal-unpin-assignment")) {
                    let assignmentElm = e.srcElement.parentElement.parentElement;
                    assignmentElm.children[6].innerHTML = assignmentElm.children[6].innerHTML.replace("betterportal-unpin-assignment", "betterportal-pin-assignment").replace("Unpin", "Pin");
                    pinnedAssignments = pinnedAssignments.filter(x => x.id != e.srcElement.dataset.id);
                    if (pinnedAssignments.length == 0) bpData.remove("betterportal-pinned-assignments");
                    else bpData.set("betterportal-pinned-assignments", pinnedAssignments, true);
                }
            }]);
            const assignments = [...document.querySelector("tbody#assignment-center-assignment-items").children];
            console.log("Assignments Loaded!", assignments.length);
        } else if (lastPagePath == "/app/student" && lastPageHash.startsWith("#assignmentdetail/")) {
            await waitForElm("div#assignment-detail-assignment .bb-tile-content-section");
            const [_, assignmentId, assignmentIndexId] = lastPageHash.match(/#assignmentdetail\/(\d+)\/(\d+)/);
            if (await getSetting("savednotes")) {
                if (!document.querySelector("#betterportal-text-content")) {
                    document.querySelector("#assignment-detail-assignment .bb-tile-content-section").innerHTML += `<div id="betterportal-text-content">
      <div class="well well-sm" style="margin:10px 0px 5px 0px">
        <h3>Saved Notes</h3>
        <textarea id="betterportal-savedinfo" style="min-height:100px;width:100%;resize:vertical;"></textarea>
      </div>
    </div>`;
                }
                document.querySelector("#betterportal-text-content textarea").value = bpData.get(`betterportal-si-${assignmentId}_${assignmentIndexId}`, "");
                events.push(['input', (e) => {
                    if (e.srcElement.id == "betterportal-savedinfo") {
                        if (e.srcElement.value.length == 0) bpData.remove(`betterportal-si-${assignmentId}_${assignmentIndexId}`);
                        else bpData.set(`betterportal-si-${assignmentId}_${assignmentIndexId}`, e.srcElement.value);
                    }
                }])
            }
            if (await getSetting("classlinks")) {
                const assignmentDetails = document.querySelector("#assignment-detail-assignment .bb-tile-content-section button");
                const groupName = assignmentDetails.innerText.split('| ').pop().split(' (')[0];
                const group = portalContext.Groups.find((x) => x.GroupName == groupName && x.CurrentEnrollment);
                
                if (!document.querySelector("#betterportal-link-content")) {
                    document.querySelector("#assignment-detail-assignment .bb-tile-content-section").innerHTML += `<div id="betterportal-link-content">
      <div class="well well-sm" style="margin:10px 0px 5px 0px">
        <h3>Class Links</h3>
        <ul>
            ${group ? `<li><a href="#academicclass/${group.CurrentSectionId}/0/bulletinboard">Class Bulletin Board</a></li>` : ""}
        </ul>
      </div>
    </div>`;
                }
            }    
        }
        events.map((x) => document.body.addEventListener(x[0], x[1]));
    }, 25);
})();
