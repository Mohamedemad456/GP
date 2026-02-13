import "../styles/page-loader.css";

type PageLoaderProps = {
  fullscreen?: boolean;
};

export default function PageLoader({ fullscreen = true }: PageLoaderProps) {
  return (
    <div className={`page-loader ${fullscreen ? "page-loader--fullscreen" : "page-loader--embedded"}`}>
      <div className="page-loader__scene">
        {/* Car */}
        <div className="page-loader__car">
          <span className="page-loader__windshield"></span>
          <span className="page-loader__body"></span>
          <span className="page-loader__wheels"></span>
        </div>

        {/* Speed lines */}
        <div className="page-loader__strikes">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* Road */}
        <div className="page-loader__road">
          <div className="page-loader__road-line"></div>
        </div>
      </div>

      <p className="page-loader__text">Loading</p>
    </div>
  );
}
