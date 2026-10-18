import { SITE } from "../../lib/site";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.475 2 2 6.475 2 12c0 4.425 2.865 8.17 6.84 9.49.5.09.68-.215.68-.48 0-.235-.01-.85-.01-1.67-2.78.605-3.37-1.34-3.37-1.34-.455-1.155-1.11-1.465-1.11-1.465-.905-.62.07-.605.07-.605 1 .07 1.525 1.03 1.525 1.03.89 1.525 2.335 1.085 2.9.83.09-.645.345-1.085.63-1.335-2.22-.25-4.555-1.11-4.555-4.94 0-1.09.39-1.985 1.03-2.685-.105-.25-.45-1.27.095-2.645 0 0 .84-.27 2.75 1.025a9.55 9.55 0 0 1 5 0C16.18 4.63 17.02 4.9 17.02 4.9c.545 1.375.2 2.395.095 2.645.64.7 1.03 1.595 1.03 2.685 0 3.84-2.34 4.685-4.57 4.93.36.31.68.915.68 1.85 0 1.335-.01 2.415-.01 2.745 0 .265.18.575.69.475A10.005 10.005 0 0 0 22 12c0-5.525-4.475-10-10-10Z" />
    </svg>
  );
}

function WechatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 3C4.36 3 1 5.91 1 9.5c0 2.03 1.06 3.84 2.72 5.05l-.68 2.28 2.65-1.42c.71.2 1.46.32 2.24.35-.09-.4-.14-.81-.14-1.23 0-3.5 3.31-6.34 7.4-6.34.17 0 .34 0 .51.02C15.15 5.24 12.13 3 8.5 3Zm-2.65 3.9c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm5.3 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1ZM15.2 9.5c-3.53 0-6.4 2.43-6.4 5.42 0 2.99 2.87 5.42 6.4 5.42.65 0 1.28-.08 1.88-.23l2.34 1.25-.6-2.01C20.38 18.31 21.6 16.73 21.6 14.92c0-2.99-2.87-5.42-6.4-5.42Zm-2.15 3.15c.44 0 .8.36.8.8s-.36.8-.8.8-.8-.36-.8-.8.36-.8.8-.8Zm4.3 0c.44 0 .8.36.8.8s-.36.8-.8.8-.8-.36-.8-.8.36-.8.8-.8Z" />
    </svg>
  );
}

export default function SiteFooter() {
  const { footer } = SITE;
  const year = new Date().getFullYear();

  return (
    <footer className="siteFooter">
      <div className="siteFooterMain">
        <div className="siteFooterInfo">
          <span className="siteFooterTitle">{SITE.name}</span>
          <p>{SITE.description}</p>

          <div className="siteFooterLinks">
            <a
              className="siteFooterLink"
              href={footer.github.href}
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon />
              <span>{footer.github.label}</span>
            </a>

            {footer.wechat.href ? (
              <a
                className="siteFooterLink"
                href={footer.wechat.href}
                target="_blank"
                rel="noreferrer"
              >
                <WechatIcon />
                <span>{footer.wechat.value}</span>
              </a>
            ) : (
              <span className="siteFooterLink siteFooterWechat">
                <WechatIcon />
                <span>{footer.wechat.value}</span>
              </span>
            )}
          </div>
        </div>

        {footer.wechat.qr && (
          <div className="siteFooterWechatCard">
            <img src={footer.wechat.qr} alt={`${footer.wechat.value}二维码`} />
            <strong>{footer.wechat.value}</strong>
          </div>
        )}
      </div>

      <div className="siteFooterMeta">
        <span>© {year} {SITE.name}</span>
      </div>
    </footer>
  );
}
