"use client";

import { useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowDownRight,
  ArrowRight,
  Barcode,
  BookOpen,
  Check,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CookingPot,
  Heart,
  Home,
  Leaf,
  ListChecks,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Settings2,
  ShoppingBasket,
  Sparkles,
  Sun,
  UsersRound,
  X,
} from "lucide-react";

type Recipe = {
  id: number;
  name: string;
  note: string;
  minutes: number;
  tags: string[];
  image: string;
  ingredients: string[];
  score: number;
  sourceUrl?: string;
};

type GroceryItem = { name: string; aisle: string; checked: boolean };

const recipes: Recipe[] = [
  {
    id: 1,
    name: "Green goddess grain bowl",
    note: "Crisp greens, warm grains, herby tahini",
    minutes: 25,
    tags: ["Vegetarian", "Weeknight"],
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=960&q=85",
    ingredients: ["avocado", "cherry tomatoes", "quinoa", "baby spinach"],
    score: 96,
  },
  {
    id: 2,
    name: "Lemon butter salmon",
    note: "With blistered green beans & dill",
    minutes: 30,
    tags: ["High protein", "Gluten-free"],
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=960&q=85",
    ingredients: ["salmon", "green beans", "lemon", "fresh dill"],
    score: 92,
  },
  {
    id: 3,
    name: "Roasted tomato orzo",
    note: "Slow-roasted tomatoes, a little parmesan",
    minutes: 35,
    tags: ["Vegetarian", "Comfort"],
    image: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=960&q=85",
    ingredients: ["orzo", "cherry tomatoes", "parmesan", "basil"],
    score: 89,
  },
];

const initialPantry = [
  { name: "Extra virgin olive oil", amount: "Almost full", icon: "◉" },
  { name: "Chickpeas", amount: "2 cans", icon: "◌" },
  { name: "Baby spinach", amount: "1 bag", icon: "✳" },
];

const dinnerIdeas = [
  { title: "Miso-glazed aubergine", detail: "with sesame rice", time: "35 min", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85" },
  { title: "Crispy chickpea bowls", detail: "with lemony greens", time: "25 min", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85" },
  { title: "Herby roast chicken", detail: "with market vegetables", time: "50 min", image: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=85" },
];

const navItems = [
  { label: "Overview", icon: Home },
  { label: "Recipe box", icon: BookOpen },
  { label: "My pantry", icon: CookingPot },
  { label: "Groceries", icon: ShoppingBasket },
  { label: "Meal planner", icon: ListChecks },
];

export default function HomePage() {
  const [dark, setDark] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Everything");
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantry] = useState(initialPantry);
  const [groceries, setGroceries] = useState<GroceryItem[]>([
    { name: "Oat milk", aisle: "Dairy & alternatives", checked: false },
    { name: "Sourdough loaf", aisle: "Bakery", checked: false },
    { name: "Lemons", aisle: "Produce", checked: true },
  ]);
  const [pantryDraft, setPantryDraft] = useState("");
  const [dinnerIndex, setDinnerIndex] = useState(0);
  const [modal, setModal] = useState<"import" | "cook" | "beam" | "scan" | null>(null);
  const [importName, setImportName] = useState("");
  const [notice, setNotice] = useState("");
  const [cookStep, setCookStep] = useState(0);
  const [receiptName, setReceiptName] = useState("");

  const filteredRecipes = useMemo(() => [...customRecipes, ...recipes].filter((recipe) => {
    const matchesQuery = `${recipe.name} ${recipe.note} ${recipe.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "Everything" || recipe.tags.includes(category);
    return matchesQuery && matchesCategory;
  }), [category, customRecipes, query]);

  const saveRecipe = () => {
    const source = importName.trim();
    if (!source) return;
    const isUrl = /^https?:\/\//i.test(source);
    const recipeName = isUrl ? "Saved recipe link" : source;
    setCustomRecipes((current) => [{
      id: Date.now(),
      name: recipeName,
      note: isUrl ? "Link saved · recipe extraction is not connected" : "Added to your recipe box",
      minutes: 30,
      tags: ["New"],
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=960&q=85",
      ingredients: [],
      score: 100,
      sourceUrl: isUrl ? source : undefined,
    }, ...current]);
    setNotice(isUrl ? "Link saved. Connect a recipe parser to extract its ingredients." : `“${source}” added to your recipe box`);
    setImportName("");
    setModal(null);
    window.setTimeout(() => setNotice(""), 3000);
  };
  const addRecipeToGroceries = (recipe: Recipe) => {
    const pantryNames = pantry.map((item) => item.name.toLowerCase());
    const aisleFor: Record<string, string> = {
      avocado: "Produce", "cherry tomatoes": "Produce", quinoa: "Grains & pasta", "baby spinach": "Produce",
      salmon: "Seafood", "green beans": "Produce", lemon: "Produce", "fresh dill": "Produce",
      orzo: "Grains & pasta", parmesan: "Dairy & alternatives", basil: "Produce",
    };
    const missing = recipe.ingredients
      .filter((name) => !pantryNames.some((pantryName) => pantryName.includes(name) || name.includes(pantryName)))
      .map((name) => ({ name, aisle: aisleFor[name] ?? "Other", checked: false }));
    setGroceries((current) => {
      const currentNames = new Set(current.map((item) => item.name.toLowerCase()));
      return [...current, ...missing.filter((item) => !currentNames.has(item.name.toLowerCase()))];
    });
    setNotice(missing.length ? `${missing.length} ingredients added to your grocery list` : "Your pantry already has everything for this one");
    window.setTimeout(() => setNotice(""), 2800);
  };

  const addPantryItem = () => {
    const name = pantryDraft.trim();
    if (!name) return;
    setPantry((current) => [...current, { name, amount: "Just added", icon: "◌" }]);
    setPantryDraft("");
  };

  const toggleGrocery = (name: string) => {
    setGroceries((current) => current.map((item) => item.name === name ? { ...item, checked: !item.checked } : item));
  };

  const playStep = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(cookSteps[cookStep]));
    }
  };

  const cookSteps = [
    "Rinse the quinoa under cold water, then simmer in salted water until fluffy, about 15 minutes.",
    "Whisk tahini, lemon juice, a splash of warm water, and a pinch of salt until silky.",
    "Toss the warm grains with spinach, tomatoes, and sliced avocado. Spoon over the dressing.",
  ];
  const dinner = dinnerIdeas[dinnerIndex];
  const aisleGroups = groceries.reduce<Record<string, GroceryItem[]>>((groups, item) => {
    groups[item.aisle] = [...(groups[item.aisle] ?? []), item];
    return groups;
  }, {});

  return (
    <div className={`app-shell${dark ? " theme-dark" : ""}`}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveNav("Overview")} aria-label="PantryIQ home">
          <span className="brand-mark"><Leaf size={17} strokeWidth={2.2} /></span>
          <span>pantry<span className="brand-light">IQ</span></span>
        </button>
        <div className="home-label">YOUR KITCHEN</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item${activeNav === label ? " selected" : ""}`} onClick={() => setActiveNav(label)}>
              <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
              {label === "Groceries" && groceries.length > 0 && <span className="nav-count">{groceries.filter((item) => !item.checked).length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="household-card">
          <div className="household-top"><UsersRound size={16} /><span>THE HOUSEHOLD</span></div>
          <div className="avatar-stack"><span className="mini-avatar avatar-sage">M</span><span className="mini-avatar avatar-rose">J</span><span className="mini-avatar avatar-ochre">+1</span></div>
          <p>Cooking better, together.</p>
          <button className="household-link" onClick={() => setModal("beam")}>Pair a device <ArrowRight size={14} /></button>
        </div>
        <button className="settings-link" onClick={() => setNotice("Settings are ready to personalize") }><Settings2 size={17} /><span>Settings</span></button>
        <div className="sidebar-profile"><div className="profile-photo">M</div><div><strong>Maya Chen</strong><small>Home cook</small></div><ChevronDown size={16} /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Sunday, November 1</span><span className="breadcrumb-dot">/</span><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a recipe..." aria-label="Search recipes" /><kbd>⌘ K</kbd></label>
            <button className="icon-button theme-toggle" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setNotice("Use the navigation panel to explore your kitchen") }><Menu size={19} /></button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> SUNDAY, NOVEMBER 1, 2026</p>
              <h1>What sounds good<br className="title-break" /> <em>tonight, Maya?</em></h1>
              <p className="welcome-copy">A little inspiration for a lovely week around the table.</p>
            </div>
            <div className="welcome-actions">
              <button className="button button-outline" onClick={() => setModal("import")}><Plus size={16} /> Add a recipe</button>
              <button className="button button-sage" onClick={() => { setCookStep(0); setModal("cook"); }}><ChefHat size={17} /> Cook mode</button>
            </div>
          </section>

          <section className="quick-tools" aria-label="Kitchen tools">
            <button onClick={() => setModal("import")}><span className="tool-icon terracotta"><BookOpen size={17} /></span><span><strong>Save a recipe</strong><small>URL or write your own</small></span><ArrowRight size={15} className="tool-arrow" /></button>
            <button onClick={() => setModal("scan")}><span className="tool-icon sage"><Barcode size={17} /></span><span><strong>Scan a receipt</strong><small>Refresh your pantry</small></span><ArrowRight size={15} className="tool-arrow" /></button>
            <button onClick={() => setModal("beam")}><span className="tool-icon ochre"><Sparkles size={17} /></span><span><strong>Pair a device</strong><small>Bring the kitchen along</small></span><ArrowRight size={15} className="tool-arrow" /></button>
          </section>

          <div className="section-heading recipe-heading">
            <div><p className="eyebrow">A GOOD PLACE TO START</p><h2>Picked for your week</h2></div>
            <button className="text-link" onClick={() => setActiveNav("Recipe box")}>Your recipe box <ArrowRight size={15} /></button>
          </div>
          <div className="filter-row" role="group" aria-label="Filter recipes">
            {["Everything", "Vegetarian", "High protein", "Weeknight"].map((filter) => <button key={filter} className={category === filter ? "filter-chip active" : "filter-chip"} onClick={() => setCategory(filter)}>{filter}</button>)}
            <button className="filter-settings" onClick={() => setNotice("Recipe preferences are ready to tune") }><Settings2 size={15} /> Preferences</button>
          </div>
          <div className="recipe-grid">
            {filteredRecipes.length ? filteredRecipes.map((recipe, index) => (
              <article className="recipe-card" key={recipe.id} style={{ animationDelay: `${index * 70}ms` }}>
                <div className="recipe-image" style={{ backgroundImage: `url('${recipe.image}')` }}>
                  <span className="score-pill"><Sparkles size={12} /> {recipe.score}% fit</span>
                  <button className="save-recipe" aria-label={`Save ${recipe.name}`} onClick={(event) => { event.currentTarget.classList.toggle("is-saved"); }}><Heart size={17} /></button>
                </div>
                <div className="recipe-body">
                  <div className="recipe-meta"><span><AlarmClock size={13} /> {recipe.minutes} min</span><span className="meta-divider" />{recipe.tags[0]}</div>
                  <h3>{recipe.name}</h3><p>{recipe.note}</p>
                  <button className="add-ingredients" onClick={() => addRecipeToGroceries(recipe)}><Plus size={14} /> Add ingredients <ArrowDownRight size={14} /></button>
                </div>
              </article>
            )) : <div className="empty-results"><CircleHelp size={20} /><span>No recipes found. Try another search or filter.</span></div>}
          </div>

          <div className="lower-grid">
            <section className="dinner-panel">
              <div className="section-heading compact-heading"><div><p className="eyebrow">YOUR SUNDAY PLAN</p><h2>Tonight at the table</h2></div><span className="plan-date">SUN <strong>01</strong></span></div>
              <div className="dinner-feature">
                <div className="dinner-photo" style={{ backgroundImage: `url('${dinner.image}')` }} />
                <div className="dinner-info"><span className="tiny-label">DINNER IDEA · {dinner.time}</span><h3>{dinner.title}</h3><p>{dinner.detail}</p><div className="dinner-buttons"><button className="button button-sage small-button" onClick={() => { setCookStep(0); setModal("cook"); }}>Let&apos;s cook <ArrowRight size={14} /></button><button className="round-button" aria-label="Try another dinner idea" onClick={() => setDinnerIndex((dinnerIndex + 1) % dinnerIdeas.length)}><ChevronRight size={18} /></button></div></div>
              </div>
            </section>

            <section className="pantry-panel">
              <div className="section-heading compact-heading"><div><p className="eyebrow">ON HAND</p><h2>Your pantry <span className="green-count">{pantry.length}</span></h2></div><button className="text-link small-link" onClick={() => setActiveNav("My pantry")}>View all <ArrowRight size={14} /></button></div>
              <div className="pantry-list">
                {pantry.slice(0, 4).map((item, index) => <div className="pantry-item" key={`${item.name}-${index}`}><span className={`pantry-symbol pantry-symbol-${index % 3}`}>{item.icon}</span><span className="pantry-name">{item.name}</span><span className="pantry-amount">{item.amount}</span></div>)}
              </div>
              <form className="add-pantry-form" onSubmit={(event) => { event.preventDefault(); addPantryItem(); }}><input value={pantryDraft} onChange={(event) => setPantryDraft(event.target.value)} placeholder="Add an item" aria-label="Add pantry item" /><button type="submit" aria-label="Add pantry item"><Plus size={17} /></button></form>
              <button className="scan-link" onClick={() => setModal("scan")}><Barcode size={15} /> Scan receipt or barcode</button>
            </section>
          </div>

          <section className="grocery-panel">
            <div className="section-heading compact-heading"><div><p className="eyebrow">THE MARKET LIST</p><h2>Next grocery run <span className="list-count">{groceries.filter((item) => !item.checked).length} left</span></h2></div><button className="text-link small-link" onClick={() => setActiveNav("Groceries")}>Open list <ArrowRight size={14} /></button></div>
            <div className="grocery-groups">
              {Object.entries(aisleGroups).map(([aisle, items]) => <div className="aisle-group" key={aisle}><span className="aisle-name">{aisle}</span>{items.map((item) => <button key={item.name} className={`grocery-item${item.checked ? " checked" : ""}`} onClick={() => toggleGrocery(item.name)}><span className="check-circle">{item.checked && <Check size={12} />}</span>{item.name}</button>)}</div>)}
              {!groceries.length && <p className="empty-groceries">Your list is clear. Add ingredients from a recipe when inspiration strikes.</p>}
            </div>
          </section>

          <footer className="page-footer"><span>Made for good things around the table.</span><span><Leaf size={13} /> PantryIQ kitchen journal</span></footer>
        </div>
      </main>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className={`dialog${modal === "cook" ? " cook-dialog" : ""}`} role="dialog" aria-modal="true" aria-label={modal === "import" ? "Add a recipe" : modal === "cook" ? "Cooking mode" : modal === "scan" ? "Scan pantry items" : "Pair a device"}>
          <button className="dialog-close" onClick={() => setModal(null)} aria-label="Close"><X size={18} /></button>
          {modal === "import" && <>
            <span className="dialog-icon terracotta"><BookOpen size={19} /></span><p className="eyebrow">YOUR RECIPE BOX</p><h2>Bring something<br /><em>good to the table.</em></h2>
            <p className="dialog-copy">Paste a recipe link or give your new favorite a name. Link parsing is a local preview until an ingestion service is connected.</p>
            <label className="field-label">Recipe link or name<input value={importName} onChange={(event) => setImportName(event.target.value)} placeholder="https:// or Sunday pasta..." /></label>
            <button className="button button-sage dialog-submit" disabled={!importName.trim()} onClick={saveRecipe}>Save recipe <ArrowRight size={15} /></button>
          </>}
          {modal === "cook" && <>
            <span className="dialog-icon sage"><ChefHat size={19} /></span><p className="eyebrow">COOKING MODE · GREEN GODDESS GRAIN BOWL</p><h2>Take it one step<br /><em>at a time.</em></h2>
            <div className="step-progress"><span style={{ width: `${((cookStep + 1) / cookSteps.length) * 100}%` }} /></div><div className="step-count">STEP {cookStep + 1} OF {cookSteps.length}</div><p className="cook-instruction">{cookSteps[cookStep]}</p>
            <div className="cook-controls"><button className="button button-outline" onClick={playStep}><Mic size={16} /> Read aloud</button><button className="button button-sage" onClick={() => cookStep < cookSteps.length - 1 ? setCookStep(cookStep + 1) : setModal(null)}>{cookStep === cookSteps.length - 1 ? "Finish cooking" : "Next step"}<ChevronRight size={16} /></button></div>
            <p className="privacy-note">Voice playback uses your device&apos;s built-in speech. Wake lock is not enabled in this preview.</p>
          </>}
          {modal === "scan" && <>
            <span className="dialog-icon sage"><Barcode size={20} /></span><p className="eyebrow">SMART PANTRY</p><h2>A little inventory<br /><em>refresh.</em></h2>
            <p className="dialog-copy">Choose a receipt photo to preview the pantry scan flow. Item recognition is simulated in this local build.</p>
            <label className="upload-zone"><input type="file" accept="image/*" onChange={(event) => setReceiptName(event.target.files?.[0]?.name ?? "")} /><span className="upload-mark"><Plus size={18} /></span><strong>{receiptName || "Choose a receipt photo"}</strong><small>JPG or PNG · local preview only</small></label>
            <button className="button button-sage dialog-submit" disabled={!receiptName} onClick={() => { setNotice("Scan preview ready. Connect an OCR service to extract items."); setModal(null); window.setTimeout(() => setNotice(""), 3200); }}>Preview scan <ArrowRight size={15} /></button>
          </>}
          {modal === "beam" && <>
            <span className="dialog-icon ochre"><Sparkles size={19} /></span><p className="eyebrow">PANTRYIQ COMPANION</p><h2>Your kitchen,<br /><em>in sync.</em></h2>
            <p className="dialog-copy">Pairing is a preview in this build. A live companion connection needs a secure pairing service.</p>
            <div className="pair-code"><div className="qr-pattern" aria-hidden="true">{Array.from({ length: 64 }, (_, index) => <i key={index} className={(index * 7 + index % 5) % 3 === 0 ? "on" : ""} />)}</div><span><strong>PAIRING PREVIEW</strong><small>Kitchen display · not connected</small></span></div>
            <button className="button button-outline dialog-submit" onClick={() => setModal(null)}>Done <Check size={15} /></button>
          </>}
        </section>
      </div>}
    </div>
  );
}