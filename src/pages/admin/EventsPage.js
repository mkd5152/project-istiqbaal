import { useNavigate } from 'react-router-dom';
import EventsGrid from '../../components/grids/EventsGrid';

export default function EventsPage(){
  const navigate = useNavigate();
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>All Events</h2>
        <button
          onClick={() => navigate('/admin/events/new')}
          style={{ backgroundColor:'#006400', color:'#fff', border:'none', padding:'10px 16px', borderRadius:999, fontWeight:800, cursor:'pointer' }}
        >
          + Create Event
        </button>
      </div>
      <EventsGrid />
    </div>
  );
}