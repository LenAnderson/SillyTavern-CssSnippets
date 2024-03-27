import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { power_user } from '../../../power-user.js';
import { registerSlashCommand } from '../../../slash-commands.js';
import { delay, getSortableDelay } from '../../../utils.js';


class Snippet {
    static from(props) {
        if (props.isTheme !== undefined) delete props.isTheme;
        return Object.assign(new this(), props);
    }
    /**@type {String}*/ name = '';
    /**@type {Boolean}*/ isDisabled = false;
    /**@type {Boolean}*/ isGlobal = true;
    /**@type {String}*/ content = '';
    /**@type {Boolean}*/ isCollapsedd = false;
    get isTheme() {
        return settings.themeSnippets[power_user.theme]?.includes(this.name);
    }
    get themeList() {
        return Object.keys(settings.themeSnippets).filter(key=>settings.themeSnippets[key]?.includes(this.name));
    }
    get theme() {
        return this.themeList.join(';');
    }
    get css() {
        return this.content;
    }
    get title() {
        return this.name;
    }

    constructor(content = '', name = '') {
        this.content = content;
        this.name = name;
    }
}

class Settings {
    static from(props) {
        props.snippetList = props.snippetList.map(it=>Snippet.from(it));
        return Object.assign(new Settings, props);
    }
    /**@type {Snippet[]}*/ snippetList = [];
    // @ts-ignore
    /**@type {Map<string,string>}*/ themeSnippets = {};
    // @ts-ignore
    /**@type {Map<string,Boolean>}*/ filters = {};
}


const initSettings = ()=>{
    settings = Settings.from(extension_settings.cssSnippets);
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

    registerSlashCommand(
        'csss',
        (args, value)=>showCssManager(),
        [],
        '<span class="monospace"></span> – Show the CSS Snippet Manager.',
        true,
        true,
    );
    registerSlashCommand(
        'csss-on',
        (args, value)=>{
            const snippet = settings.snippetList.find(it=>it.name.toLowerCase() == value.toLowerCase());
            if (!snippet) {
                return toastr.warning(`No such snippet: ${value}`);
            }
            snippet.isDisabled = false;
            const sdm = snippetDomMapper.find(it=>it.snippet == snippet);
            if (sdm) {
                sdm.li.querySelector('.csss--isDisabled').checked = snippet.isDisabled;
            }
            save();
        },
        [],
        '<span class="monospace">(snippet name)</span> – Enable a CSS snippet.',
        true,
        true,
    );
    registerSlashCommand(
        'csss-off',
        (args, value)=>{
            const snippet = settings.snippetList.find(it=>it.name.toLowerCase() == value.toLowerCase());
            if (!snippet) {
                return toastr.warning(`No such snippet: ${value}`);
            }
            snippet.isDisabled = true;
            const sdm = snippetDomMapper.find(it=>it.snippet == snippet);
            if (sdm) {
                sdm.li.querySelector('.csss--isDisabled').checked = snippet.isDisabled;
            }
            save();
        },
        [],
        '<span class="monospace">(snippet name)</span> – Disable a CSS snippet.',
        true,
        true,
    );
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



/**@type {Settings} */
let settings;
/**@type {Window} */
let manager;
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
/**@type {HTMLElement} */
let expAll;
/**@type {Object[]} */
let snippetDomMapper = [];
/**@type {HTMLElement} */
let collapser;

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
    saveSettingsDebounced();
    updateCss();
};

const updateExportSelection = ()=>{
    selectedCount.textContent = `${selectedList.length}`;
    const filtered = snippetDomMapper.filter(it=>!it.li.classList.contains('csss--isFiltered') && !it.li.classList.contains('csss--isHidden')).map(it=>it.snippet);
    const isAll = selectedList.length == settings.snippetList.length;
    const isFiltered = selectedList.length == filtered.length && !selectedList.find(it=>!filtered.includes(it));
    if (isFiltered && !isAll) {
        expAll.title = 'Select all snippets, including hidden / filtered';
    } else if (isAll) {
        expAll.title = 'Deselect all snippets';
    } else {
        expAll.title = 'Select all visible / unfiltered snippets';
    }
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
        snippetDomMapper.push({ snippet, li });
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
            updateExportSelection();
        });
        const collapseToggle = li.querySelector('.csss--collapse');
        collapseToggle.addEventListener('click', ()=>{
            const result = li.classList.toggle('csss--isCollapsed');
            collapseToggle.classList[result ? 'add' : 'remove']('fa-angle-down');
            collapseToggle.classList[!result ? 'add' : 'remove']('fa-angle-up');
            snippet.isCollapsed = result;
            const uncol = settings.snippetList.filter(it=>!it.isCollapsed);
            if (uncol.length > 0) {
                collapser.classList.remove('fa-angles-down');
                collapser.classList.add('fa-angles-up');
                collapser.title = 'Collapse snippets';
            } else {
                collapser.classList.add('fa-angles-down');
                collapser.classList.remove('fa-angles-up');
                collapser.title = 'Uncollapse snippets';
            }
            save();
        });
        if (snippet.isCollapsed) {
            collapseToggle.click();
        }
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
                if (snippet.isTheme) {
                    settings.themeSnippets[power_user.theme].splice(settings.themeSnippets[power_user.theme].indexOf(snippet.name), 1);
                } else {
                    settings.themeSnippets[power_user.theme].push(snippet.name);
                }
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
                    snippetDomMapper.splice(snippetDomMapper.findIndex(it=>it.snippet == snippet), 1);
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
        `${location.protocol}//${location.host}/scripts/extensions/third-party/SillyTavern-CssSnippets/html/manager.html`,
        'snippetManager',
        [
            'popup',
            'innerWidth=700',
            'innerHeight=500',
        ].join(','),
    );
    await new Promise(resolve=>{
        let isResolved = false;
        delay(2000).then(()=>{
            if (isResolved) return;
            console.log('[CSSS]', 'LOAD TIMEOUT');
            isResolved = true;
            // manager.window.alert(`Manager window load event timed out after 2 seconds.\n\nLet's try to continue anyways.`);
            resolve();
        });
        manager.addEventListener('load', (evt)=>{
            if (isResolved) return;
            console.log('[CSSS]', 'LOAD', evt);
            isResolved = true;
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
        const base = document.createElement('base');
        base.href = `${location.protocol}//${location.host}`;
        manager.document.head.append(base);
        // manager.document.body.innerHTML = '<h1>Loading...</h1>';
        Array.from(document.querySelectorAll('link[rel="stylesheet"]:not([href*="/extensions/"]), style')).forEach(it=>manager.document.head.append(it.cloneNode(true)));
        managerStyle = manager.document.querySelector('#csss--css-snippets');
    };
    setup();
    /**@type {HTMLElement} */
    const dom = manager.document.querySelector('#csss--root');
    // @ts-ignore
    manager.sortableStop = ()=>{
        // @ts-ignore
        settings.snippetList.sort((a,b)=>Array.from(list.children).findIndex(it=>it.snippet == a) - Array.from(list.children).findIndex(it=>it.snippet == b));
        saveSettingsDebounced();
    };
    // @ts-ignore
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

    collapser = dom.querySelector('#csss--collapse');
    collapser.addEventListener('click', ()=>{
        const uncol = settings.snippetList.filter(it=>!it.isCollapsed);
        if (uncol.length > 0) {
            uncol.forEach(snippet=>snippetDomMapper.find(sdm=>sdm.snippet == snippet).li.querySelector('.csss--collapse').click());
        } else {
            settings.snippetList.forEach(snippet=>snippetDomMapper.find(sdm=>sdm.snippet == snippet).li.querySelector('.csss--collapse').click());
        }
    });
    // @ts-ignore
    snippetTemplate = dom.querySelector('#csss--snippet').content.querySelector('.csss--snippet');
    const list = dom.querySelector('#csss--list');
    settings.snippetList.forEach(snippet=>{
        const li = makeSnippetDom(snippet);
        list.append(li);
    });
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
            snippets.push(new Snippet(text));
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
    expAll = dom.querySelector('#csss--export-selectAll');
    let expMsg = dom.querySelector('#csss--export-message');
    let expCopy = dom.querySelector('#csss--export-copy');
    let expDownload = dom.querySelector('#csss--export-download');
    selectedCount = dom.querySelector('#csss--count');
    const stopExporting = ()=>{
        isExporting = false;
        dom.classList.remove('csss--isExporting');
        Array.from(dom.querySelectorAll('.csss--snippet.csss--selected')).forEach(it=>it.classList.remove('csss--selected'));
        while (selectedList.length > 0) selectedList.pop();
        [exp, expAll, expMsg, expCopy, expDownload].forEach(it=>it.classList.remove('csss--active'));
        updateExportSelection();
    };
    exp.addEventListener('click', ()=>{
        if (isExporting) {
            return stopExporting();
        }
        updateExportSelection();
        isExporting = true;
        dom.classList.add('csss--isExporting');
        [exp, expAll, expMsg, expCopy, expDownload].forEach(it=>it.classList.add('csss--active'));
    });
    expAll.addEventListener('click', ()=>{
        const filtered = snippetDomMapper.filter(it=>!it.li.classList.contains('csss--isFiltered') && !it.li.classList.contains('csss--isHidden')).map(it=>it.snippet);
        const isAll = selectedList.length == settings.snippetList.length;
        const isFiltered = selectedList.length == filtered.length && !selectedList.find(it=>!filtered.includes(it));
        if (isFiltered && !isAll) {
            // select all, including hidden snippets
            for (const snippet of settings.snippetList) {
                if (selectedList.includes(snippet)) continue;
                selectedList.push(snippet);
                snippetDomMapper.find(it=>it.snippet == snippet).li.classList.add('csss--selected');
            }
        } else if (isAll) {
            // unselect all snippets
            while (selectedList.length > 0) {
                const snippet = selectedList.pop();
                snippetDomMapper.find(it=>it.snippet == snippet).li.classList.remove('csss--selected');
            }
        } else {
            // select all visible / unfiltered snippets
            // first deselect all filtered snippets
            const deselect = [];
            for (const snippet of selectedList) {
                if (!filtered.includes(snippet)) deselect.push(snippet);
            }
            for (const snippet of deselect) {
                selectedList.splice(selectedList.indexOf(snippet), 1);
                snippetDomMapper.find(it=>it.snippet == snippet).li.classList.remove('csss--selected');
            }
            // then select missing snippets
            for (const snippet of filtered) {
                if (selectedList.includes(snippet)) continue;
                selectedList.push(snippet);
                snippetDomMapper.find(it=>it.snippet == snippet).li.classList.add('csss--selected');
            }
        }
        updateExportSelection();
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

    /**@type {HTMLInputElement} */
    const search = dom.querySelector('#csss--searchQuery');
    search.title = [
        'Search snippets',
        '—'.repeat(30),
        'Default: search in snippet name',
        'Use a prefix to search in all or in specific fields.',
        '—'.repeat(30),
        'all:  search in name, content, theme',
        'content:  search in snippet content / CSS',
        'css:  alias for content:',
        'theme:  search in assigned themes',
        'name:  search in name (redundant, this is the default field to search in)',
        'title:  alias for name:',
    ].join('\n');
    search.addEventListener('input', ()=>{
        let fields = ['name', 'title', 'content', 'theme', 'css'];
        let query = search.value;
        if (search.value.startsWith('all:')) {
            query = search.value.slice(4).trim();
        } else if (fields.includes(search.value.split(':')[0])) {
            query = search.value.split(':').slice(1).join(':');
            fields = [search.value.split(':')[0]];
        }
        const re = new RegExp(query, 'i');
        for (const snippet of settings.snippetList) {
            const li = snippetDomMapper.find(it=>it.snippet == snippet).li;
            let found = false;
            for (const field of fields) {
                found = found || re.test(snippet[field]);
            }
            if (found) {
                li.classList.remove('csss--isHidden');
            } else {
                li.classList.add('csss--isHidden');
            }
        }
    });
    const applyFilter = ()=>{
        for (const snippet of settings.snippetList) {
            const li = snippetDomMapper.find(it=>it.snippet == snippet).li;
            if (
                (settings.filters.disabled && snippet.isDisabled)
                || (settings.filters.theme && !settings.themeSnippets[power_user.theme]?.includes(snippet.name) && Object.keys(settings.themeSnippets).map(key=>settings.themeSnippets[key]).filter(it=>it.includes(snippet.name)).length > 0)
                || (settings.filters.global && snippet.isGlobal)
                || (settings.filters.thisTheme && settings.themeSnippets[power_user.theme]?.includes(snippet.name))
            ) {
                li.classList.add('csss--isFiltered');
            } else {
                li.classList.remove('csss--isFiltered');
            }
        }
        updateExportSelection();
    };
    applyFilter();
    const filterBtn = dom.querySelector('#csss--filter');
    let filterMenu;
    filterBtn.addEventListener('click', ()=>{
        if (filterMenu) {
            filterMenu.remove();
            filterMenu = null;
            return;
        }
        const rect = filterBtn.getBoundingClientRect();
        filterMenu = document.createElement('div'); {
            filterMenu.classList.add('csss--filterMenu');
            filterMenu.classList.add('list-group');
            filterMenu.style.top = `${rect.top + rect.height}px`;
            filterMenu.style.right = `${manager.innerWidth - rect.right}px`;
            [
                { key:'disabled', label:'Hide disabled snippets' },
                { key:'theme', label:'Hide snippets for other themes' },
                { key:'thisTheme', label:'Hide snippets for this theme' },
                { key:'global', label:'Hide global snippets' },
            ].forEach(filter=>{
                const item = document.createElement('label'); {
                    item.classList.add('csss--item');
                    item.title = filter.label;
                    const cb = document.createElement('input'); {
                        cb.type = 'checkbox';
                        cb.checked = settings.filters[filter.key];
                        cb.addEventListener('click', ()=>{
                            settings.filters[filter.key] = cb.checked;
                            save();
                            applyFilter();
                        });
                        item.append(cb);
                    }
                    item.append(filter.label);
                    filterMenu.append(item);
                }
            });
            manager.document.body.append(filterMenu);
        }
    });

    dom.querySelector('.csss--add').addEventListener('click', ()=>{
        const snippet = new Snippet();
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
