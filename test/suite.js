import { assert, log, mock, unmock, summary, wait } from "./tester.js";

const LONG_DELAY = 1000;
const MEDIUM_DELAY = 500;
const SMALL_DELAY = 100;

async function loadApp(timeout = LONG_DELAY) {
    localStorage.removeItem("new.db.sql");
    const app = {};
    app.frame = document.querySelector("#app");
    app.frame.src = "../index.html";
    await wait(timeout);
    app.window = app.frame.contentWindow;
    app.document = app.window.document;
    app.actions = app.window.app.actions;
    app.gister = app.window.app.gister;
    app.ui = app.window.app.ui;
    return app;
}

async function testNewDatabase() {
    log("New database...");
    const app = await loadApp();
    const h1 = app.document.querySelector(".header h1");
    assert(
        "shows header",
        h1.innerText.trim() == "SQLite Playground  // new.db"
    );
    assert("editor is empty", app.ui.editor.value == "");
    assert(
        "command bar is disabled",
        app.ui.commandbar.classList.contains("disabled")
    );
    assert("shows welcome text", app.ui.status.value.includes("demo database"));
    assert("result is empty", app.ui.result.innerText == "");
}

async function testExecuteQuery() {
    log("Execute query...");
    const app = await loadApp();
    const sql = "select 'hello' as message";
    // activate buttons
    app.ui.editor.dispatchEvent(new Event("input"));
    app.ui.editor.value = sql;
    app.ui.buttons.execute.click();
    await wait(MEDIUM_DELAY);
    assert("shows result", app.ui.result.innerText.includes("hello"));
    assert("shows query in editor", app.ui.editor.value == sql);
    assert(
        "caches query in local storage",
        localStorage.getItem("new.db.sql") == sql
    );
}

async function loadDemo() {
    log("Load demo...");
    const app = await loadApp();
    const sql = "select * from employees";
    const btn = app.ui.status.querySelector('[data-action="load-demo"]');
    btn.click();
    await wait(MEDIUM_DELAY);
    assert("shows query in editor", app.ui.editor.value.startsWith(sql));
    assert("shows row count", app.ui.status.value.includes("10 rows"));
    assert("shows employees", app.ui.result.innerText.includes("Diane"));
}

async function loadUrl() {
    log("Load url...");
    const app = await loadApp();
    app.window.location.assign("../index.html#demo.db");
    await wait(MEDIUM_DELAY);
    assert("shows database name", app.ui.name.value == "demo.db");
    app.ui.buttons.showTables.click();
    await wait(MEDIUM_DELAY);
    assert("shows tables", app.ui.status.value == "2 tables:");
}

async function loadUrlInvalid() {
    log("Load invalid url...");
    const app = await loadApp();
    app.window.location.assign("../index.html#whatever");
    await wait(MEDIUM_DELAY);
    assert("shows error", app.ui.status.value.includes("Failed to load"));
    assert("editor is empty", app.ui.editor.value == "");
    assert("result is empty", app.ui.result.innerText == "");
}

async function loadGist() {
    log("Load gist...");
    const app = await loadApp();
    app.window.location.assign(
        "../index.html#gist:e012594111ce51f91590c4737e41a046"
    );
    await wait(LONG_DELAY);
    assert("shows database name", app.ui.name.value == "employees.en.db");
    assert("shows query in editor", app.ui.editor.value.startsWith("select"));
    assert("shows result", app.ui.result.innerText.includes("Diane"));
}

async function loadGistInvalid() {
    log("Load invalid gist...");
    const app = await loadApp();
    app.window.location.assign("../index.html#gist:42");
    await wait(LONG_DELAY);
    assert("shows error", app.ui.status.value.includes("Failed to load"));
    assert("editor is empty", app.ui.editor.value == "");
    assert("result is empty", app.ui.result.innerText == "");
}

async function showTables() {
    log("Show tables...");
    const app = await loadApp();
    app.window.location.assign("../index.html#demo.db");
    await wait(MEDIUM_DELAY);
    app.ui.buttons.showTables.click();
    await wait(MEDIUM_DELAY);
    assert("shows table count", app.ui.status.value == "2 tables:");
    assert("shows table list", app.ui.result.innerText.includes("employees"));
    const btn = app.ui.result.querySelector('[data-action="show-table"]');
    btn.click();
    await wait(MEDIUM_DELAY);
    assert("shows table navbar", app.ui.status.value == "tables / employees:");
    assert(
        "shows table columns",
        app.ui.result.innerText.includes("department")
    );
}

async function saveAnonymous() {
    log("Save anonymous snippet...");
    const app = await loadApp();
    const sql = "select 'hello' as message";
    // activate buttons
    app.ui.editor.dispatchEvent(new Event("input"));
    app.ui.editor.value = sql;
    app.ui.buttons.save.click();
    await wait(MEDIUM_DELAY);
    assert(
        "save redirects to settings",
        app.window.location.pathname == "/settings.html"
    );
}

async function saveEmpty() {
    log("Save empty snippet...");
    const app = await loadApp();

    // set github credentials to enable saving
    app.gister.username = "test";
    app.gister.password = "test";

    // activate buttons
    app.ui.editor.dispatchEvent(new Event("input"));
    app.ui.editor.value = "";
    app.ui.buttons.save.click();
    await wait(MEDIUM_DELAY);
    assert(
        "fails to save empty snippet",
        app.ui.status.value.startsWith("Failed to save")
    );

    // remove github credentials
    app.gister.username = null;
    app.gister.password = null;
}

async function save() {
    log("Save snippet...");
    const app = await loadApp();

    // set github credentials to enable saving
    app.gister.username = "test";
    app.gister.password = "test";

    mock(app.gister, "create", (name, schema, query) => {
        assert("before save: database name is not set", name == "new.db");
        assert("before save: database schema is empty", schema == "");
        assert("before save: database query equals query text", query == sql);
        const gist = buildGist(name, schema, query);
        return Promise.resolve(gist);
    });

    const sql = "select 'hello' as message";
    // activate buttons
    app.ui.editor.dispatchEvent(new Event("input"));
    app.ui.editor.value = sql;
    app.ui.buttons.save.click();
    await wait(MEDIUM_DELAY);
    assert(
        "after save: database named after gist id",
        app.ui.name.value == "424242.db"
    );
    assert(
        "after save: shows successful status",
        app.ui.status.value == "Saved as gist copy share link"
    );

    unmock(app.gister, "create");

    // remove github credentials
    app.gister.username = null;
    app.gister.password = null;
}

async function update() {
    log("Update snippet...");
    const app = await loadApp();

    // set github credentials to enable saving
    app.gister.username = "test";
    app.gister.password = "test";

    const sql1 = "select 'created' as message";
    const sql2 = "select 'updated' as message";

    mock(app.gister, "create", (name, schema, query) => {
        const gist = buildGist(name, schema, query);
        return Promise.resolve(gist);
    });

    mock(app.gister, "update", (id, name, schema, query) => {
        assert("before save: database name is set", name == "424242.db");
        assert("before save: database schema is empty", schema == "");
        assert(
            "before save: database query equals updated text",
            query == sql2
        );
        const gist = buildGist(id, name, schema, query);
        return Promise.resolve(gist);
    });

    // activate buttons
    app.ui.editor.dispatchEvent(new Event("input"));

    // create
    app.ui.editor.value = sql1;
    app.ui.buttons.save.click();
    await wait(MEDIUM_DELAY);

    // update
    app.ui.editor.value = sql2;
    app.ui.buttons.save.click();
    await wait(MEDIUM_DELAY);

    assert(
        "after save: shows successful status",
        app.ui.status.value == "Saved as gist copy share link"
    );

    unmock(app.gister, "create");

    // remove github credentials
    app.gister.username = null;
    app.gister.password = null;
}

async function changeName() {
    log("Change database name...");
    const app = await loadApp();
    const name = "my.db";
    app.ui.name.value = name;
    app.ui.name.dispatchEvent(new Event("change"));
    await wait(SMALL_DELAY);
    assert("shows updated name", app.ui.name.value == "my.db");
}

async function runTests() {
    log("Running tests...");
    await testNewDatabase();
    await testExecuteQuery();
    await loadDemo();
    await loadUrl();
    await loadUrlInvalid();
    await loadGist();
    await loadGistInvalid();
    await showTables();
    await saveAnonymous();
    await saveEmpty();
    await save();
    await update();
    await changeName();
    summary();
}

function buildGist(name, schema = "", query = "") {
    return {
        id: "424242131313",
        name: name,
        owner: "test",
        schema: schema,
        query: query,
    };
}

runTests();
