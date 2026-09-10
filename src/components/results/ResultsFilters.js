import React from 'react';
import { FILTER_ALL } from './resultsUtils';

const ResultsFilters = ({
  monthFilter,
  setMonthFilter,
  monthOptions,
  schoolFilter,
  setSchoolFilter,
  schoolOptions,
  locationFilter,
  setLocationFilter,
  locationOptions,
  filteredCount,
  totalCount,
}) => (
  <div className="results-filters">
    <label className="results-filter">
      <span>Month</span>
      <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
        <option value={FILTER_ALL}>All months</option>
        {monthOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>

    <label className="results-filter">
      <span>School</span>
      <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
        <option value={FILTER_ALL}>All schools</option>
        {schoolOptions.map((school) => (
          <option key={school} value={school}>
            {school}
          </option>
        ))}
      </select>
    </label>

    <label className="results-filter">
      <span>Location</span>
      <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
        <option value={FILTER_ALL}>All locations</option>
        {locationOptions.map((location) => (
          <option key={location} value={location}>
            {location}
          </option>
        ))}
      </select>
    </label>

    <div className="results-filter-count">
      Showing {filteredCount} of {totalCount}
    </div>
  </div>
);

export default ResultsFilters;
