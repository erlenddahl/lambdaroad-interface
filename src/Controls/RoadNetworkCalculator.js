import React from 'react';
import Button from 'react-bootstrap/Button';
import PropTypes from 'prop-types';
import Alert from 'react-bootstrap/Alert';
import JobTable from './JobTable.js';
import CalcHelper from "../Calculations/CalcHelper.js";
import CalculationParameters from "./CalculationParameters.js";
import { API_URL } from '../Helpers/Constants.js';
import UserSettings from '../Helpers/UserSettings.js';
import { Tooltip } from 'react-tippy';
import HelpText from './HelpText.js';

class RoadNetworkCalculator extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            isBusy: false,
            jobs: []
        };

        this.apiUrl = API_URL + "/RoadNetwork";

        this.onCalculationClicked = this.onCalculationClicked.bind(this);
        this.generateConfig = this.generateConfig.bind(this);
        this.toggleResults = this.toggleResults.bind(this);
        this.onDeleteRequested = this.onDeleteRequested.bind(this);
        this.onAbortRequested = this.onAbortRequested.bind(this);
        this.onCalculationParametersChanged = this.onCalculationParametersChanged.bind(this);
        
        this.helper = new CalcHelper();
    }
    
    async componentDidMount() {
        await this.loadJobs();
        await this.refreshJobStatuses();
    }

    componentWillUnmount() {
        clearInterval(this.intervalID);
    }

    async refreshJobStatuses() {

        if(this.parameterValues?.apiKey){

            if(!this.state.jobs || this.state.jobs.length < 1){
                await this.loadJobs();
            }else{

                try{
                    await Promise.all(this.state.jobs.map(async p => {

                        if(p.status == "Failed" || p.status == "Finished") return;

                        const data = await this.post("status", { key: p.data.Id }, true);
                        if(!data?.data){
                            // This job has been finished, and will not return status data anymore.
                            // Reload the job list to fetch the final item.
                            await this.loadJobs();
                            return; 
                        }
                        
                        this.updateJobState(data);
                    }));
                }catch(ex){
                    console.log(ex);
                }
            }
        }

        this.intervalID = setTimeout(this.refreshJobStatuses.bind(this), 1000);
    }

    updateJobState(data){
        if(this.state.jobs.error) return;
        this.setState(state => ({
            jobs: state.jobs.filter(p => p.data.Id !== data.data.Id).concat(data).sort((a,b) => a.data.Enqueued.localeCompare(b.data.Enqueued))
        }));
    }

    async onDeleteRequested(job){
        this.setBusy(true);

        try{
            const data = await this.post("delete", { key: job.data.Id }, true);
            
            if(data.error){
                this.setState({ calculationError: data.error });
            }

            await this.loadJobs();

            if(this.props.currentGeoJsonLayerName == this.getLayerName(job)){
                this.props.onAddGeoJsonLayer(null, null);
            }

        }catch(ex){
            this.setState({ calculationError: ex.message });
        }

        this.setBusy(false);
    }

    async onAbortRequested(job){
        try{
            const data = await this.post("abort", { key: job.data.Id }, true);
            
            if(data.error){
                this.setState({ calculationError: data.error });
            }

            await this.loadJobs();

        }catch(ex){
            this.setState({ calculationError: ex.message });
        }
    }

    async loadJobs(){

        if(!this.parameterValues?.apiKey) return;

        try{
            const data = await this.post("jobs", null, true);

            if(data.error){
                this.setState({ jobs: null, calculationError: data.error });
            }else{
                this.setState({ jobs: data.map(p => p) });
            }

        }catch(ex){
            console.log(ex);
            this.setState({ jobs: { error: ex.message || JSON.stringify(ex) } });
        }
    }

    async generateConfig(){
        if(this.hasParameterErrors()){
            console.log("Calculation aborted -- parameters has errors");
            return;
        }

        this.setBusy(true);

        try{
            const data = await this.post("generateConfig", this.getCalculationRequestBody());
            
            alert(JSON.stringify(data, null, 4));

        }catch(ex){
            this.setState({ calculationError: ex.message });
        }

        this.setBusy(false);
    }

    async toggleResults(job){

        if(this.props.currentGeoJsonLayerName == this.getLayerName(job)){
            this.props.onAddGeoJsonLayer(null, null);
            return;
        }

        this.setBusy(true);

        try{
            const data = await this.post("results", { key: job.data.Id }, true);
            const geoJson = {
                "type": "FeatureCollection",
                "features": data.links.map(p => ({
                    "type": "Feature", 
                    "properties": {...p, isLink: true}, 
                    "geometry": { 
                        "type": "LineString", 
                        "coordinates": p.Points.map(c => this.helper.toWgsArr([c[0], c[1]]))
                    } 
                }))
            };

            this.props.onAddGeoJsonLayer(this.getLayerName(job), geoJson);

        }catch(ex){
            this.setState({ calculationError: ex.message });
        }

        this.setBusy(false);
    }

    getLayerName(job){
        return "results-geojson-" + job.data.Id;
    }

    async post(route, body, apiKeyOnly){
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.helper.addCalculationParameters(body, this.parameterValues, apiKeyOnly))
        };
        const response = await fetch(this.apiUrl + (route ? "/" + route : ""), requestOptions);
        return await response.json();
    }

    getCalculationRequestBody(){
        return {
            "baseStations": this.props.selectedStations.map(p => this.helper.toBaseStationObject(p))
        };
    }

    hasParameterErrors(){
        return this.parameterErrors && Object.keys(this.parameterErrors).length;
    }

    async onCalculationClicked(){

        if(this.hasParameterErrors()){
            console.log("Calculation aborted -- parameters has errors");
            return;
        }

        this.setBusy(true);

        try{
            const data = await this.post("", this.getCalculationRequestBody())

            if(data.error){
                this.setState({ calculationError: data.error, isBusy: false });
                return;
            }

            this.updateJobState(data);

        }catch(ex){
            this.setState({ calculationError: ex.message });
        }

        this.setBusy(false);
    }

    setBusy(value){
        this.setState(s => ({ isBusy: value, calculationError: value ? null : s.calculationError }));
    }

    onCalculationParametersChanged(values, errors){
        this.parameterErrors = errors;
        this.parameterValues = values;

        if(!this.hasParameterErrors()){
            UserSettings.setCalculationParameters(this.parameterValues);
        }
    }

    render() {

        const calculationStartBlocks = this.state.isBusy || !this.props.selectedStations.length || (this.parameterErrors && this.parameterErrors.length > 0);

        return <div className="sidebar-content-container" style={this.props.style}>

            <div className="sidebar-content-controls">

                <HelpText className="my-3" tooltip="Use the input fields below to configure a new calculation, select the stations you want included by clicking them on the map, then start the calculation by clicking 'Calculate'.">
                    <h3>New calculation</h3>
                </HelpText>

                <CalculationParameters onValuesChanged={this.onCalculationParametersChanged}></CalculationParameters>

                <Alert className="my-3" variant="info">{this.props.selectedStations.length} stations selected for calculations. Click a station on the map to select or deselect it.</Alert>
                
                <Tooltip title="Start a new calculation running on the server.">
                    <Button onClick={this.onCalculationClicked} disabled={calculationStartBlocks}>Calculate</Button>
                </Tooltip>

                <Tooltip title="Generate a config file that you (with minor edits) can run on your own computer. This option may be quicker, especially if there are long-running jobs running on the server. See the 'Offline calculations' section in the documentation.">
                    <Button className="mx-2" variant="secondary" onClick={this.generateConfig} disabled={calculationStartBlocks}>Generate config for offline calculation</Button>
                </Tooltip>

                <br />
                <HelpText className="my-3 mt-5" tooltip="A list of calculations started using this API key. From here you can see calculation progress, show results on the map, download results, or delete old calculations.">
                    <h3>Calculation log</h3>
                </HelpText>
                {this.state.calculationError && <Alert className="mt-4" variant="danger">{this.state.calculationError}</Alert>}

                <br />
                <JobTable jobs={this.state.jobs} currentGeoJsonLayerName={this.props.currentGeoJsonLayerName} onResultToggleRequested={this.toggleResults} onDeleteRequested={this.onDeleteRequested} onAbortRequested={this.onAbortRequested}></JobTable>
            </div>
        </div>
    }
}

RoadNetworkCalculator.propTypes = {
    style: PropTypes.object,
    selectedStations: PropTypes.array,
    onAddGeoJsonLayer: PropTypes.func,
    currentGeoJsonLayerName: PropTypes.string
};

export default RoadNetworkCalculator;