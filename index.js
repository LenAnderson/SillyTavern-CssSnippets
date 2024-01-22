import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { power_user } from '../../../power-user.js';
import { delay, getSortableDelay } from '../../../utils.js';


const initSettings = ()=>{
    settings = Object.assign({
        snippetList: [],
        themeSnippets: {},
    }, extension_settings.cssSnippets ?? {});
    extension_settings.cssSnippets = settings;
};
const init = async()=>{
    initSettings();
    const h4 = document.querySelector('#CustomCSS-block > h4');
    const btn = document.createElement('span'); {
        btn.classList.add('csss--trigger');
        btn.classList.add('menu_button');
        btn.classList.add('menu_button_icon');
        btn.classList.add('fa-solid');
        btn.classList.add('fa-list-check');
        btn.title = 'Manage CSS snippets';
        btn.addEventListener('click', ()=>showCssManager());
        h4.append(btn);
    }
    updateCss();
    addEventListener('beforeunload', ()=>manager?.close());

    themeLoop();
};
const themeLoop = async()=>{
    let theme = power_user.theme;
    while (true) {
        if (theme != power_user.theme) {
            theme = power_user.theme;
            updateCss();
            if (manager) {
                Array.from(manager.document.querySelectorAll('[data-csss]')).forEach(li=>{
                    const name = li.getAttribute('data-csss');
                    // @ts-ignore
                    li.querySelector('.csss--isTheme').checked = settings.themeSnippets[power_user.theme]?.find(it=>it == name);
                });
            }
        }
        await delay(500);
    }
};
eventSource.on(event_types.APP_READY, ()=>init());



/**@type {Object} */
let settings;
/**@type {Window} */
let manager;
/**@type {HTMLElement} */
let managerTemplate;
/**@type {HTMLElement} */
let snippetTemplate;
/**@type {HTMLStyleElement} */
let style;
/**@type {HTMLStyleElement} */
let managerStyle;
/**@type {Boolean} */
let isExporting = false;
/**@type {Object[]} */
let selectedList = [];
/**@type {HTMLElement} */
let selectedCount;

const updateCss = ()=>{
    if (!style) {
        style = document.createElement('style');
        style.id = 'csss--css-snippets';
        document.head.append(style);
    }
    style.innerHTML = [
        '/*',
        ' * === GLOBAL SNIPPETS ===',
        ' */',
        settings.snippetList
            .filter(it=>!it.isDisabled && it.isGlobal)
            .map(it=>`/* SNIPPET: ${it.name} */\n${it.content}`)
            .join('\n\n'),
        '\n\n\n\n',
        '/*',
        ' * === THEME SNIPPETS ===',
        ' */',
        settings.themeSnippets[power_user.theme]
            ?.map(name=>settings.snippetList.find(it=>!it.isDisabled && it.name == name))
            ?.filter(it=>it)
            ?.map(it=>`/* SNIPPET: ${it.name} */\n${it.content}`)
            ?.join('\n\n'),
    ].join('\n');
    if (managerStyle) {
        managerStyle.innerHTML = style.innerHTML;
    }
};
const save = ()=>{
    settings.themeSnippets[power_user.theme] = settings.snippetList.filter(it=>it.isTheme).map(it=>it.name);
    saveSettingsDebounced();
    updateCss();
};

const expand = (snippet, ta) => {
    const blocker = document.createElement('div'); {
        blocker.classList.add('csss--blocker');
        const body = document.createElement('div'); {
            body.classList.add('csss--body');
            body.classList.add('drawer-content');
            const inp = document.createElement('textarea'); {
                inp.classList.add('csss--input');
                inp.value = snippet.content;
                inp.addEventListener('input', ()=>{
                    snippet.content = inp.value.trim();
                    ta.value = snippet.content;
                    save();
                });
                body.append(inp);
            }
            const ok = document.createElement('button'); {
                ok.classList.add('csss--ok');
                ok.textContent = 'OK';
                ok.addEventListener('click', ()=>{
                    blocker.remove();
                });
                body.append(ok);
            }
            blocker.append(body);
        }
        manager.document.body.append(blocker);
    }
};
const makeSnippetDom = (snippet)=>{
    /**@type {HTMLElement} */
    // @ts-ignore
    const li = snippetTemplate.cloneNode(true); {
        li.snippet = snippet;
        li.setAttribute('data-csss', snippet.name);
        li.addEventListener('click', ()=>{
            if (!isExporting) return;
            li.classList.toggle('csss--selected');
            if (li.classList.contains('csss--selected')) {
                selectedList.push(snippet);
            } else {
                const idx = selectedList.indexOf(snippet);
                if (idx != -1) {
                    selectedList.splice(idx, 1);
                }
            }
            selectedCount.textContent = `${selectedList.length}`;
        });
        /**@type {HTMLInputElement} */
        const name = li.querySelector('.csss--name'); {
            name.value = snippet.name;
            name.addEventListener('paste', (evt)=>evt.stopPropagation());
            name.addEventListener('input', ()=>{
                snippet.name = name.value.trim();
                li.setAttribute('data-csss', snippet.name);
                save();
            });
        }
        /**@type {HTMLInputElement} */
        const isDisabled = li.querySelector('.csss--isDisabled'); {
            isDisabled.checked = snippet.isDisabled;
            isDisabled.addEventListener('click', ()=>{
                snippet.isDisabled = isDisabled.checked;
                save();
            });
        }
        /**@type {HTMLInputElement} */
        const isGlobal = li.querySelector('.csss--isGlobal'); {
            isGlobal.checked = snippet.isGlobal;
            isGlobal.addEventListener('click', ()=>{
                snippet.isGlobal = isGlobal.checked;
                save();
            });
        }
        /**@type {HTMLInputElement} */
        const isTheme = li.querySelector('.csss--isTheme'); {
            isTheme.checked = settings.themeSnippets[power_user.theme]?.find(it=>it == snippet.name);
            isTheme.addEventListener('click', ()=>{
                snippet.isTheme = isTheme.checked;
                save();
            });
        }
        /**@type {HTMLTextAreaElement} */
        const content = li.querySelector('.csss--content'); {
            content.value = snippet.content;
            content.addEventListener('paste', (evt)=>evt.stopPropagation());
            content.addEventListener('input', ()=>{
                snippet.content = content.value.trim();
                save();
            });
        }
        /**@type {HTMLElement} */
        const max = li.querySelector('.csss--max'); {
            max.addEventListener('click', ()=>{
                expand(snippet, content);
            });
        }
        /**@type {HTMLElement} */
        const remove = li.querySelector('.csss--remove'); {
            remove.addEventListener('click', ()=>{
                if (manager.window.confirm('Are you sure you want to delete this CSS snippet?\n\nThis cannot be undone!')) {
                    settings.snippetList.splice(settings.snippetList.indexOf(snippet), 1);
                    li.remove();
                    save();
                }
            });
        }
    }
    return li;
};
const showCssManager = async()=>{
    if (manager) {
        manager.focus();
        return;
    }
    manager = window.open(
        'about:blank',
        'snippetManager',
        [
            'popup',
            'innerWidth=700',
            'innerHeight=500',
        ].join(','),
    );
    await new Promise(resolve=>{
        manager.addEventListener('load', (evt)=>{
            console.log('[CSSS]', 'LOAD', evt);
            resolve();
        });
    });
    let isUnloaded = false;
    manager.addEventListener('unload', (evt)=>{
        console.log('[CSSS]', 'UNLOAD (no action)', evt);
        isUnloaded = true;
    });
    if (!manager) return;
    const setup = ()=>{
        manager.document.title = 'SillyTavern CSS Snippets';
        manager.document.head.parentElement.setAttribute('style', document.head.parentElement.getAttribute('style'));
        manager.document.body.classList.add('csss--body');
        manager.document.body.innerHTML = '<h1>Loading...</h1>';
        Array.from(document.querySelectorAll('link[rel="stylesheet"]:not([href*="/extensions/"]), style')).forEach(it=>manager.document.head.append(it.cloneNode(true)));
        managerStyle = manager.document.querySelector('#csss--css-snippets');
    };
    setup();
    if (!managerTemplate) {
        const response = await fetch('/scripts/extensions/third-party/SillyTavern-CssSnippets/html/manager.html', { cache: 'no-store' });
        if (response.ok) {
            // @ts-ignore
            managerTemplate = document.createRange().createContextualFragment(await response.text()).querySelector('#csss--root');
            // @ts-ignore
            snippetTemplate = managerTemplate.querySelector('#csss--snippet').content.querySelector('.csss--snippet');
        }
    }
    /**@type {HTMLElement} */
    // @ts-ignore
    const dom = managerTemplate.cloneNode(true);
    const list = dom.querySelector('#csss--list');
    settings.snippetList.forEach(snippet=>{
        const li = makeSnippetDom(snippet);
        list.append(li);
    });
    manager.sortableStop = ()=>{
        settings.snippetList.sort((a,b)=>Array.from(list.children).findIndex(it=>it.snippet == a) - Array.from(list.children).findIndex(it=>it.snippet == b));
        saveSettingsDebounced();
    };
    manager.sortableDelay = getSortableDelay();
    const scripts = [
        '/lib/jquery-3.5.1.min.js',
        '/lib/jquery-ui.min.js',
    ];
    for (const s of scripts) {
        const response = await fetch(s);
        if (response.ok) {
            const script = manager.document.createElement('script');
            script.innerHTML = await response.text();
            dom.append(script);
        }
    }
    const sortableScript = manager.document.createElement('script');
    sortableScript.innerHTML = `
        $('#csss--list').sortable({
            delay: window.sortableDelay,
            stop: window.sortableStop,
        });
    `;
    dom.append(sortableScript);

    /**@type {HTMLInputElement} */
    const imp = dom.querySelector('#csss--import-file');
    imp.addEventListener('input', async()=>{
        for (const file of imp.files) {
            try {
                importSnippets(await file.text());
            } catch { /* empty */ }
        }
    });
    const importSnippets = (text)=>{
        const snippets = [];
        try {
            snippets.push(...JSON.parse(text));
        } catch {
            // if not JSON, treat as plain CSS
            snippets.push({
                name: '',
                isDisabled: false,
                isGlobal: true,
                isTheme: false,
                content: text,
            });
        }

        let jumped = false;
        for (const snippet of snippets) {
            try {
                settings.snippetList.push(snippet);
                const li = makeSnippetDom(snippet);
                list.append(li);
                if (!jumped) {
                    li.scrollIntoView();
                    jumped = true;
                }
            } catch { /* empty */ }
        }
    };
    dom.querySelector('#csss--import').addEventListener('click', ()=>imp.click());
    dom.addEventListener('paste', (evt)=>{
        importSnippets(evt.clipboardData.getData('text'));
    });
    let exp = dom.querySelector('#csss--export');
    let expMsg = dom.querySelector('#csss--export-message');
    let expCopy = dom.querySelector('#csss--export-copy');
    let expDownload = dom.querySelector('#csss--export-download');
    selectedCount = dom.querySelector('#csss--count');
    const stopExporting = ()=>{
        isExporting = false;
        dom.classList.remove('csss--isExporting');
        Array.from(dom.querySelectorAll('.csss--snippet.csss--selected')).forEach(it=>it.classList.remove('csss--selected'));
        while (selectedList.length > 0) selectedList.pop();
        [exp, expMsg, expCopy, expDownload].forEach(it=>it.classList.remove('csss--active'));
        selectedCount.textContent = `${selectedList.length}`;
    };
    exp.addEventListener('click', ()=>{
        if (isExporting) {
            return stopExporting();
        }
        selectedCount.textContent = `${selectedList.length}`;
        isExporting = true;
        dom.classList.add('csss--isExporting');
        [exp, expMsg, expCopy, expDownload].forEach(it=>it.classList.add('csss--active'));
    });
    expCopy.addEventListener('click', ()=>{
        if (!isExporting) return;
        if (selectedList.length > 0) {
            const ta = document.createElement('textarea'); {
                ta.value = JSON.stringify(selectedList);
                ta.style.position = 'fixed';
                ta.style.inset = '0';
                dom.append(ta);
                ta.focus();
                ta.select();
                try {
                    manager.document.execCommand('copy');
                } catch (err) {
                    console.error('Unable to copy to clipboard', err);
                }
                ta.remove();
            }
        }
        stopExporting();
    });
    expDownload.addEventListener('click', ()=>{
        if (!isExporting) return;
        if (selectedList.length > 0) {
            const blob = new Blob([JSON.stringify(selectedList)], { type:'text' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); {
                a.href = url;
                a.download = `SillyTavern-CSS-Snippets-${new Date().toISOString()}.json`;
                a.click();
            }
        }
        stopExporting();
    });

    dom.querySelector('.csss--add').addEventListener('click', ()=>{
        const snippet = {
            name: '',
            isDisabled: false,
            isGlobal: true,
            isTheme: false,
            content: '',
        };
        settings.snippetList.push(snippet);
        const li = makeSnippetDom(snippet);
        list.append(li);
        li.scrollIntoView();
    });

    if (isUnloaded) {
        console.log('[CSSS]', 'running setup again');
        setup();
    }
    manager.document.body.innerHTML = '';
    manager.document.body.append(dom);
    let onUnloadBound;
    const onUnload = (evt)=>{
        console.log('[CSSS]', 'UNLOAD', evt, evt.target.defaultView, evt.target.defaultView == manager);

        manager.removeEventListener('unload', onUnloadBound);
        manager = null;
    };
    onUnloadBound = onUnload.bind(this);
    manager.addEventListener('unload', onUnloadBound);
};
