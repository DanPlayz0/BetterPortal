let timeout = null;

const chromeVer = chrome.runtime.getManifest().version;
document.querySelector("#bpversion").textContent = chromeVer;
document.querySelector("#bpheadermessage").innerHTML = `(Latest Version - Deprecated)`;
// fetch(chrome.runtime.getManifest().browser_specific_settings.gecko.update_url.replace('updates.json', `check?version=${chromeVer}`)).then(res=>res.json()).then(json => {
//     if (!("canUpdate" in json) && !("latest_version" in json)) return;
//     if (json.canUpdate) document.querySelector("#bpheadermessage").innerHTML = `(Update Available: ${json.latest_version})`;
//     else if (json.latest_version != chromeVer) document.querySelector("#bpheadermessage").innerHTML = `(DEVELOPMENT)`;
//     else document.querySelector("#bpheadermessage").innerHTML = `(Latest Version)`;
// })

const saveOptions = () => {
  const sortby = document.getElementById('sortby').value;
  const sortdir = document.getElementById('sortdir').value;
  const overduecolor = document.getElementById('overduecolor').value == 'none' ? null : document.getElementById('overduecolor-custom').value;
  const showbuttons = document.getElementById('show-buttons').checked;
  
  const savednotes = document.getElementById('saved-notes').checked;
  const classlinks = document.getElementById('class-links').checked;
  const resize_submissions = document.getElementById('resize-submissions').checked;

  const cloudsync = document.getElementById('cloud-sync').checked;
  const disable_extension = document.getElementById('disable-extension').checked;

  chrome.storage.sync.set(
    {
        sortby: sortby,
        sortdir: sortdir,
        showbuttons: showbuttons,
        overduecolor: overduecolor,

        savednotes: savednotes,
        classlinks: classlinks,
        resize_submissions: resize_submissions,

        cloudsync: cloudsync,
        disable_extension: disable_extension
    },
    () => {
      // Update status to let user know options were saved.
      const settingsHr = document.querySelector("#settingsEnd hr");
      const settingsText = document.querySelector('#settingsEnd h3');

      settingsHr.style = "display: none;";
      settingsText.style = "";
      settingsText.textContent = 'Options saved.';
      if(timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        settingsHr.style = "";
        settingsText.textContent = '';
        settingsText.style = "display: none;";
      }, 750);
    }
  );
};

// Restores select box and checkbox state using the preferences
const restoreOptions = () => {
  chrome.storage.sync.get(
    { sortby: 'none', sortdir: 'asc', savednotes: true, classlinks: true, showbuttons: true, overduecolor: null, cloudsync: true, disable_extension: false, resize_submissions: true },
    (items) => {
        // Assignement Center
        document.getElementById('sortby').value = items.sortby;
        if(items.sortby != 'none') document.getElementById('ac-sortdir').style = '';

        document.getElementById('sortdir').value = items.sortdir;
        document.getElementById('show-buttons').checked = items.showbuttons;
        
        document.getElementById('overduecolor').value = items.overduecolor == null ? 'none' : 'custom';
        if(items.overduecolor != null) {
            document.getElementById('overduecolor-custom').value = items.overduecolor;
            document.getElementById('ac-overduecolor-custom').style = '';
        }
        
        // Assignement Page
        document.getElementById('saved-notes').checked = items.savednotes;
        document.getElementById('class-links').checked = items.classlinks;
        document.getElementById('resize-submissions').checked = items.resize_submissions;

        // System
        document.getElementById('cloud-sync').checked = items.cloudsync;
        document.getElementById('disable-extension').checked = items.disable_extension;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);

// Assignment Center
document.getElementById('sortby').addEventListener('change', () => {
    const sortby = document.getElementById('sortby').value;
    const sortdir = document.getElementById('ac-sortdir');

    if (sortby === 'none') sortdir.style = 'display: none;';
    else sortdir.style = '';
});
document.getElementById('overduecolor').addEventListener('change', () => {
    const colorSelected = document.getElementById('overduecolor').value;
    const customColorDiv = document.getElementById('ac-overduecolor-custom');

    if (colorSelected === 'none') customColorDiv.style = 'display: none;';
    else customColorDiv.style = '';
});

// General
document.querySelectorAll("input[type='checkbox']").forEach((el) => {
    el.addEventListener("click", (e) => e.stopPropagation());
    el.parentElement.addEventListener("click", (e) => el.checked = !el.checked);
});

let showingSystemOptions = false;
document.querySelector("#bpversion").addEventListener("click", (e) => {
    e.stopPropagation();
    showingSystemOptions = !showingSystemOptions;
    document.querySelector("#system").style.display = showingSystemOptions ? "" : "none";
});