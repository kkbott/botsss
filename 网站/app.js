/**
 * 个人网站的前端脚本：读取 content.js 里的内容，填入页面并加上一点交互。
 * 一般不需要改这个文件；改文案请编辑 content.js。
 */
(() => {
  'use strict';

  const C = window.SITE_CONTENT || {};
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const text = (value) => (value === null || value === undefined ? '' : String(value));
  const getPath = (path) =>
    path.split('.').reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), C);

  const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value) => text(value).replace(/[&<>"']/g, (character) => escapeMap[character]);
  const pad = (number) => String(number).padStart(2, '0');

  const name = text(C.name || '你的名字').trim() || '你的名字';
  const tagline = text(C.tagline).trim();
  const about = C.about && typeof C.about === 'object' ? C.about : {};
  const contact = C.contact && typeof C.contact === 'object' ? C.contact : {};
  const works = Array.isArray(C.works) ? C.works.filter((work) => work && typeof work === 'object') : [];
  const featured = works.find((work) => work.featured) || works[0] || null;
  const otherWorks = featured ? works.filter((work) => work !== featured) : [];
  const worksCount = pad(works.length);

  const targetAttrs = (href) => {
    const value = text(href).trim();
    if (!value || value.startsWith('#')) return '';
    return ' target="_blank" rel="noopener noreferrer"';
  };

  /* ── 1. 基础信息与 meta ─────────────────────────────────── */
  $$('[data-bind]').forEach((element) => {
    const value = getPath(element.dataset.bind);
    if (typeof value === 'string') {
      element.textContent = value;
      if (!value.trim()) element.hidden = true;
    }
  });

  const pageTitle = `${name} · 个人作品集`;
  const pageDescription = tagline || '个人作品集：游戏、网页与交互作品。';
  document.title = pageTitle;

  const setMeta = (selector, attribute, value) => {
    const element = $(selector);
    if (element && value) element.setAttribute(attribute, value);
  };
  setMeta('meta[name="description"]', 'content', pageDescription);
  setMeta('meta[property="og:title"]', 'content', pageTitle);
  setMeta('meta[property="og:description"]', 'content', pageDescription);
  setMeta('meta[property="og:site_name"]', 'content', name);
  setMeta('meta[name="twitter:title"]', 'content', pageTitle);
  setMeta('meta[name="twitter:description"]', 'content', pageDescription);

  $$('[data-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  /* ── 2. 数字与首页概览 ──────────────────────────────────── */
  $$('[data-works-count]').forEach((element) => {
    element.textContent = worksCount;
  });

  const stack = Array.isArray(about.tools) && about.tools.length ? text(about.tools[0]) : '—';
  $$('[data-stack]').forEach((element) => {
    element.textContent = stack;
  });
  $$('[data-updated]').forEach((element) => {
    element.textContent = text(featured && featured.year) || String(new Date().getFullYear());
  });

  /* ── 3. 首页主视觉 ──────────────────────────────────────── */
  const showcase = $('[data-showcase]');
  if (featured) {
    const image = $('[data-featured-image]');
    if (image) {
      image.src = text(featured.heroImage || featured.cover) || image.src;
      image.alt = text(featured.heroAlt || featured.coverAlt || featured.title);
    }

    const overlineParts = [featured.category, featured.year].filter((part) => text(part).trim());
    $$('[data-featured-overline]').forEach((element) => {
      element.textContent = overlineParts.join(' · ');
    });
    $$('[data-featured-title]').forEach((element) => {
      element.textContent = text(featured.title);
    });
    $$('[data-featured-title-en]').forEach((element) => {
      element.textContent = text(featured.titleEn);
      if (!text(featured.titleEn).trim()) element.hidden = true;
    });
    $$('[data-featured-badge]').forEach((element) => {
      element.textContent = text(featured.badge) || 'OPEN PROJECT';
      if (!text(featured.badge).trim()) element.hidden = true;
    });
    $$('[data-featured-play-label]').forEach((element) => {
      element.textContent = `游玩《${text(featured.title)}》`;
    });

    const heroHref = text(featured.href).trim();
    $$('[data-featured-link]').forEach((link) => {
      if (!heroHref) {
        link.hidden = true;
        return;
      }
      link.href = heroHref;
      link.setAttribute('aria-label', `打开《${text(featured.title)}》`);
    });
  } else if (showcase) {
    showcase.hidden = true;
    $$('[data-featured-link]').forEach((link) => {
      link.hidden = true;
    });
  }

  /* ── 4. 作品列表 ────────────────────────────────────────── */
  const renderWorkCard = (work) => {
    const href = text(work.href).trim();
    const cover = text(work.cover || work.heroImage).trim();
    const tags = Array.isArray(work.tags) ? work.tags : [];
    return `
      <article class="work-card reveal">
        <a class="work-card-link" href="${esc(href || '#')}"${targetAttrs(href)}>
          ${
            cover
              ? `<div class="work-card-media"><img src="${esc(cover)}" alt="${esc(work.coverAlt || work.title)}" loading="lazy" decoding="async" /></div>`
              : ''
          }
          <div class="work-card-body">
            <div class="work-card-meta">
              <span>${esc(work.category || '作品')}</span>
              <span>${esc(work.year || '')}</span>
            </div>
            <h3>${esc(work.title)}</h3>
            ${work.titleEn ? `<p class="work-card-en">${esc(work.titleEn)}</p>` : ''}
            ${work.summary ? `<p class="work-card-summary">${esc(work.summary)}</p>` : ''}
            ${
              tags.length
                ? `<ul class="tags">${tags.map((tag) => `<li class="tag">${esc(tag)}</li>`).join('')}</ul>`
                : ''
            }
            <span class="work-card-more">${esc(work.hrefLabel || '查看作品')} <span aria-hidden="true">↗</span></span>
          </div>
        </a>
      </article>`;
  };

  const featuredHost = $('[data-featured-work]');
  if (featuredHost) {
    if (!featured) {
      featuredHost.innerHTML = `
        <p class="works-note works-note-empty">
          <span>作品正在整理中，很快回来。</span>
          <span class="works-note-en" aria-hidden="true">Works coming soon</span>
        </p>`;
    } else {
      const href = text(featured.href).trim();
      const details = Array.isArray(featured.details) ? featured.details : [];
      const tags = Array.isArray(featured.tags) ? featured.tags : [];
      const cover = text(featured.cover || featured.heroImage).trim();
      featuredHost.innerHTML = `
        <article class="featured-work reveal">
          <a class="featured-visual" href="${esc(href || '#')}"${targetAttrs(href)} aria-label="打开《${esc(featured.title)}》">
            ${
              cover
                ? `<img src="${esc(cover)}" alt="${esc(featured.coverAlt || featured.title)}" width="1440" height="900" loading="lazy" decoding="async" />`
                : ''
            }
            ${featured.badge ? `<span class="featured-badge">${esc(featured.badge)}</span>` : ''}
            <span class="featured-hint" aria-hidden="true">进入作品 <span>↗</span></span>
          </a>
          <div class="featured-body">
            <div class="work-meta">
              <span>${esc(featured.category || '作品')}</span>
              <span>${esc(featured.year || '')}</span>
            </div>
            <h3 class="work-title">
              ${esc(featured.title)}
              ${featured.titleEn ? `<span class="work-title-en">${esc(featured.titleEn)}</span>` : ''}
            </h3>
            ${featured.summary ? `<p class="work-summary">${esc(featured.summary)}</p>` : ''}
            ${
              details.length
                ? `<ul class="work-points">${details.map((detail) => `<li>${esc(detail)}</li>`).join('')}</ul>`
                : ''
            }
            ${
              tags.length
                ? `<ul class="tags" aria-label="作品标签">${tags.map((tag) => `<li class="tag">${esc(tag)}</li>`).join('')}</ul>`
                : ''
            }
            <div class="work-actions">
              <a class="btn btn-solid" href="${esc(href || '#')}"${targetAttrs(href)}>
                ${esc(featured.hrefLabel || '查看作品')} <span class="arrow" aria-hidden="true">↗</span>
              </a>
              ${
                featured.source
                  ? `<a class="btn btn-ghost" href="${esc(featured.source)}" target="_blank" rel="noopener noreferrer">
                      ${esc(featured.sourceLabel || '查看源码')} <span class="arrow" aria-hidden="true">↗</span>
                    </a>`
                  : ''
              }
            </div>
          </div>
        </article>`;
    }
  }

  const moreWorksHost = $('[data-more-works]');
  const workGrid = $('[data-work-grid]');
  if (moreWorksHost && workGrid) {
    if (otherWorks.length) {
      moreWorksHost.hidden = false;
      workGrid.innerHTML = otherWorks.map(renderWorkCard).join('');
    } else {
      moreWorksHost.hidden = true;
      workGrid.innerHTML = '';
    }
  }

  const moreNote = $('[data-more-note]');
  if (moreNote) {
    const noteText = text(C.moreWorksNote).trim();
    if (otherWorks.length || !noteText) {
      moreNote.hidden = true;
    } else {
      moreNote.hidden = false;
      const textNode = moreNote.querySelector('span');
      if (textNode) textNode.textContent = noteText;
    }
  }

  /* ── 5. 关于我 ──────────────────────────────────────────── */
  const aboutCopy = $('[data-about-copy]');
  if (aboutCopy) {
    const paragraphs = Array.isArray(about.paragraphs) ? about.paragraphs.filter((paragraph) => text(paragraph).trim()) : [];
    aboutCopy.innerHTML = paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('');
    if (!paragraphs.length) aboutCopy.hidden = true;
  }

  const toolsHost = $('[data-tools]');
  if (toolsHost) {
    const tools = Array.isArray(about.tools) ? about.tools.filter((tool) => text(tool).trim()) : [];
    toolsHost.innerHTML = tools.map((tool) => `<li>${esc(tool)}</li>`).join('');
    toolsHost.hidden = !tools.length;
  }

  const factsHost = $('[data-facts]');
  if (factsHost) {
    const facts = Array.isArray(about.facts)
      ? about.facts.filter((fact) => fact && text(fact.label).trim() && text(fact.value).trim())
      : [];
    factsHost.innerHTML = facts
      .map(
        (fact) => `
        <div>
          <dt>${esc(fact.label)}</dt>
          <dd>${esc(fact.value)}</dd>
        </div>`,
      )
      .join('');
    factsHost.hidden = !facts.length;
  }

  $$('[data-monogram]').forEach((element) => {
    const characters = Array.from(name.replace(/[「」『』“”"'’\s]/g, ''));
    element.textContent = characters[0] || '·';
  });

  /* ── 6. 联系方式 ────────────────────────────────────────── */
  const email = text(contact.email).trim();
  $$('[data-email]').forEach((link) => {
    if (email) {
      link.href = `mailto:${email}`;
    } else {
      link.hidden = true;
    }
  });
  $$('[data-email-text]').forEach((element) => {
    element.textContent = email || '（未填写邮箱）';
  });

  const github = text(contact.github).trim();
  $$('[data-github]').forEach((link) => {
    if (github) {
      link.href = github;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
  });
  const githubLabel =
    text(contact.githubLabel).trim() ||
    github.replace(/^https?:\/\/(www\.)?github\.com\//i, '@').replace(/\/$/, '');
  $$('[data-github-label]').forEach((element) => {
    element.textContent = githubLabel || 'GitHub';
  });

  /* ── 7. 滚动字幕 ────────────────────────────────────────── */
  const marqueeTrack = $('[data-marquee]');
  if (marqueeTrack) {
    const marqueeItems =
      Array.isArray(C.marquee) && C.marquee.length
        ? C.marquee.filter((item) => text(item).trim())
        : works.map((work) => [work.title, work.titleEn].filter(Boolean).join(' · '));
    if (marqueeItems.length) {
      const group = `<div class="marquee-group">${marqueeItems
        .map((item) => `<span class="marquee-item">${esc(item)}</span>`)
        .join('')}</div>`;
      marqueeTrack.innerHTML = group + group;
    } else {
      const marquee = marqueeTrack.closest('.marquee');
      if (marquee) marquee.hidden = true;
    }
  }

  /* ── 8. 轻交互：滚动状态、目录高亮、入场动画 ───────────── */
  const header = $('[data-header]');
  if (header) {
    const updateHeader = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  const navLinks = new Map($$('[data-nav]').map((link) => [link.dataset.nav, link]));
  const sections = $$('[data-section]');
  if ('IntersectionObserver' in window && navLinks.size && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => link.classList.remove('is-active'));
          const active = navLinks.get(entry.target.dataset.section);
          if (active) active.classList.add('is-active');
        });
      },
      { rootMargin: '-42% 0px -52% 0px', threshold: 0 },
    );
    sections.forEach((section) => spy.observe(section));
  }

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealElements = $$('[data-reveal], .reveal');
  if (!('IntersectionObserver' in window) || motionQuery.matches) {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    revealElements.forEach((element) => revealObserver.observe(element));
  }
})();
