import { useState } from "react";
import { MENU_CATEGORIES, MENU_ITEMS } from "../data/menuItems";

export default function Menu() {
  const [activeCategory, setActiveCategory] = useState("All");

  const visibleItems =
    activeCategory === "All"
      ? MENU_ITEMS
      : MENU_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <section className="menu-section" id="menu" aria-labelledby="menu-heading">
      <div className="menu-section__inner">
        <header className="menu-section__header">
          <h2 id="menu-heading" className="menu-section__title">
            A Little Something for Every Craving.
          </h2>
          <p className="menu-section__subtitle">
            Explore our handcrafted collection of delightful frozen treats.
          </p>
        </header>

        <div className="menu-filters" role="group" aria-label="Filter menu by category">
          {MENU_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={`menu-filter-btn${isActive ? " is-active" : ""}`}
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            );
          })}
        </div>

        <ul className="menu-grid">
          {visibleItems.map((item) => (
            <li className="menu-card" key={item.id}>
              <div className="menu-card__media">
                {item.image ? (
                  <img
                    className="menu-card__image"
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="menu-card__placeholder" aria-hidden="true">
                    <svg
                      className="menu-card__placeholder-icon"
                      viewBox="0 0 64 64"
                      focusable="false"
                    >
                      <path
                        className="menu-card__placeholder-scoop"
                        d="M17 31a15 15 0 1 1 29.8 0c4.1 1.2 7.2 5 7.2 9.5 0 5.2-4.2 9.5-9.5 9.5h-25C14.2 50 10 45.7 10 40.5c0-4.5 3-8.3 7-9.5Z"
                      />
                      <path
                        className="menu-card__placeholder-cone"
                        d="M20 48h24L32 63 20 48Z"
                      />
                      <path
                        className="menu-card__placeholder-waffle"
                        d="m25 51 9 9m2-11-7 11m9-11-4 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="menu-card__body">
                <span className="menu-card__category">{item.category}</span>
                <h3 className="menu-card__name">{item.name}</h3>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
