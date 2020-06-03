pragma solidity ^0.6.7;

contract MedChain {

    //global variables
    uint internal current_pres_id = 1;
    uint internal current_file_id = 1;
    uint internal current_req_doc = 1;
    address internal oracle;
    enum auth {
        no_one,
        doc,
        phar,
        admin,
        oracle
    }

    //constructor
    constructor() public {
        oracle = msg.sender;
        oracle_auth[msg.sender] = auth.oracle;
    }

    //structs
    struct admin {
        uint id;
        address admin_address;
        bool exists;
    }

    struct patient {
        uint aadhaar;
        string name;
        string dob;
        uint weight;
        string allergies;
        string disease_history;
        uint[] prescription_ids;
        uint[] doctor_ids;
        uint[] file_ids;
        string sex;
        bool exists;
    }

    struct doctor {
        uint id;
        uint license_no;
        string name;
        string specialisation;
        address doctor_address;
        bool exists;
        uint d1_id;
        uint d2_id;
    }

    struct pharmacy {
        uint id;
        uint license_no;
        address phar_addr;
        bool exists;
    }

    struct prescription {
        uint id;
        uint doctor_id;
        uint patient_aadhaar;
        string disease;
        string symptoms;
        string medicine;
        string timestamp_prescribed;
        uint pharmacy_id;
        string timestamp_marked;
        bool marked;
    }

    struct files {
        uint id;
        string file_hash;
        string timestamp;
    }

    struct pending_doc {
        uint id;
        uint license_no;
        string name;
        string specialisation;
        address d_addr;
        uint d1;
        uint d2;
        bool d1_bool;
        bool d2_bool;
    }

    //mappings
    mapping(uint => patient) patient_aadhaar_mapping;
    mapping(uint => doctor) doctor_id_mapping;
    mapping(address => doctor) doctor_address_mapping;
    mapping(uint => pharmacy) pharmacy_id_mapping;
    mapping(address => pharmacy) pharmacy_address_mapping;
    mapping(uint => prescription) prescription_id_mapping;
    mapping(uint => admin) admin_id_mapping;
    mapping(address => auth) doctor_auth;
    mapping(address => auth) pharmacy_auth;
    mapping(address => auth) oracle_auth;
    mapping(address => auth) admin_auth;
    mapping(uint => files) file_id_mapping;
    mapping(uint => pending_doc) pending_doc_id_mapping;

    //events
    event prescription_added(uint aadhaar);

    //modifiers
    modifier only_doctor() {
        if (doctor_auth[msg.sender] == auth.doc) {
            _;
        } else {
            revert("Only Doctors can call this function");
        }
    }

    modifier only_pharmacy() {
        if (pharmacy_auth[msg.sender] == auth.phar) {
            _;
        } else {
            revert("Only Pharmacist can call this function");
        }
    }

    modifier only_admin() {
        if (admin_auth[msg.sender] == auth.admin) {
            _;
        } else {
            revert("Only admin can call this function");
        }
    }

    modifier only_oracle() {
        if (oracle_auth[msg.sender] == auth.oracle) {
            _;
        } else {
            revert("Only oracle can call this function");
        }
    }

    //internal functions
    function strConcat(string memory _a, string memory _c) internal pure returns(string memory _concatenatedString) {
        string memory _b = "-";
        string memory abcde = new string(bytes(_a).length + bytes(_b).length + bytes(_c).length);
        bytes memory babcde = bytes(abcde);
        uint k = 0;
        for (uint i = 0; i < bytes(_a).length; i++) {
            babcde[k++] = bytes(_a)[i];
        }
        for (uint i = 0; i < bytes(_b).length; i++) {
            babcde[k++] = bytes(_b)[i];
        }
        for (uint i = 0; i < bytes(_c).length; i++) {
            babcde[k++] = bytes(_c)[i];
        }
        return string(babcde);
    }

    function uint2str(uint _i) internal pure returns(string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }


    //public functions
    function add_patient(uint aadhaar, string calldata name, string calldata dob, uint weight, string calldata sex, string calldata allergies) external {
        require(!patient_aadhaar_mapping[aadhaar].exists, "Patient already exists");
        patient_aadhaar_mapping[aadhaar].aadhaar = aadhaar;
        patient_aadhaar_mapping[aadhaar].name = name;
        patient_aadhaar_mapping[aadhaar].dob = dob;
        patient_aadhaar_mapping[aadhaar].weight = weight;
        patient_aadhaar_mapping[aadhaar].sex = sex;
        patient_aadhaar_mapping[aadhaar].allergies = allergies;
        patient_aadhaar_mapping[aadhaar].exists = true;
    }

    function is_doctor_or_pharmacist() view public returns (uint) {
        if (doctor_auth[msg.sender] == auth.doc) {
            return 0;
        }
        if (pharmacy_auth[msg.sender] == auth.phar) {
            return 1;
        }
        return 2;
    }

    function edit_patient(uint aadhaar, string calldata name, uint weight, string calldata sex, string calldata allergies) external {
        require(patient_aadhaar_mapping[aadhaar].exists, "Patient doesn't exists in system");
        patient_aadhaar_mapping[aadhaar].name = name;
        patient_aadhaar_mapping[aadhaar].weight = weight;
        patient_aadhaar_mapping[aadhaar].sex = sex;
        string memory allergies_new = allergies;
        allergies_new = strConcat(patient_aadhaar_mapping[aadhaar].allergies, allergies_new);
        patient_aadhaar_mapping[aadhaar].allergies = allergies_new;
    }

    function add_doctor(uint id, uint license_no, string calldata name, string calldata specialisation, address d_addr, uint d1, uint d2) external {
        require(!doctor_id_mapping[id].exists, "Doctor already exists in system");
        doctor_id_mapping[id].id = id;
        doctor_id_mapping[id].license_no = license_no;
        doctor_id_mapping[id].name = name;
        doctor_id_mapping[id].specialisation = specialisation;
        doctor_id_mapping[id].doctor_address = d_addr;
        doctor_id_mapping[id].exists = true;
        doctor_id_mapping[id].d1_id = d1;
        doctor_id_mapping[id].d2_id = d2;
        doctor_address_mapping[d_addr].id = id;
        doctor_auth[d_addr] = auth.doc;
    }

    function add_pharmacy(uint id, uint license_no, address p_addr) external {
        require(!pharmacy_id_mapping[id].exists, "Pharmacy already exists in system");
        pharmacy_id_mapping[id].id = id;
        pharmacy_id_mapping[id].license_no = license_no;
        pharmacy_id_mapping[id].phar_addr = p_addr;
        pharmacy_id_mapping[id].exists = true;
        pharmacy_auth[p_addr] = auth.phar;
        pharmacy_address_mapping[p_addr].id = id;
    }

    function add_admin(uint id, address admin_address) external {
        require(!doctor_id_mapping[id].exists, "Admin already exists in the system");
        admin_id_mapping[id].id = id;
        admin_id_mapping[id].admin_address = admin_address;
        admin_auth[admin_address] = auth.admin;
    }

    function lookup_patient(uint aadhaar) view public returns(uint, string memory, string memory, string memory, uint, string memory) {
        return (
        patient_aadhaar_mapping[aadhaar].aadhaar,
        patient_aadhaar_mapping[aadhaar].name,
        patient_aadhaar_mapping[aadhaar].sex,
        patient_aadhaar_mapping[aadhaar].dob,
        patient_aadhaar_mapping[aadhaar].weight,
        patient_aadhaar_mapping[aadhaar].allergies
        );
    }

    function doctor_last_prescription(uint aadhaar) view public returns(uint, string memory, uint, string memory, string memory) {
        return (
        prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].id,
        prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].medicine,
        prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].doctor_id,
        prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].symptoms,
        prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].timestamp_prescribed
        );
    }

    function medical_history_details(uint aadhaar) view public returns(string memory, string memory, string memory) {
        string memory ids = "-";
        string memory d_ids = "-";
        string memory symptoms = "-";
        for (uint i = 0; i < patient_aadhaar_mapping[aadhaar].prescription_ids.length; i++) {
            ids = strConcat(ids, uint2str(prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[i]].id));
            d_ids = strConcat(d_ids, uint2str(prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[i]].doctor_id));
            symptoms = strConcat(symptoms, prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[i]].symptoms);
        }
        return (ids, d_ids, symptoms);
    }

    function medical_history(uint aadhaar) view public returns(string memory, string memory, string memory) {
        string memory dis = "-";
        string memory med = "-";
        string memory time = "-";
        for (uint i = 0; i < patient_aadhaar_mapping[aadhaar].prescription_ids.length; i++) {
            dis = strConcat(dis, prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[i]].disease);
            med = strConcat(med, prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[i]].medicine);
            time = strConcat(time, prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[i]].timestamp_prescribed);
        }
        return (dis, med, time);
    }

    function add_prescription( uint p_aadhar, string calldata disease, string calldata symptoms, string calldata medicine, string calldata time) external {
        require(patient_aadhaar_mapping[p_aadhar].exists, "Patient does not exists");
        patient_aadhaar_mapping[p_aadhar].prescription_ids.push(current_pres_id);
        prescription_id_mapping[current_pres_id].id = current_pres_id;
        prescription_id_mapping[current_pres_id].doctor_id = doctor_address_mapping[msg.sender].id;
        prescription_id_mapping[current_pres_id].patient_aadhaar = p_aadhar;
        prescription_id_mapping[current_pres_id].disease = disease;
        prescription_id_mapping[current_pres_id].symptoms = symptoms;
        prescription_id_mapping[current_pres_id].medicine = medicine;
        prescription_id_mapping[current_pres_id].timestamp_prescribed = time;
        prescription_id_mapping[current_pres_id].marked = false;
        current_pres_id = current_pres_id + 1;
        emit prescription_added(p_aadhar);
    }

    function last_prescription(uint aadhaar) view public returns(uint, string memory, string memory) {
        require(prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].marked == false, "Prescription already marked");
        uint last_presc_id = patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1];
        return (prescription_id_mapping[last_presc_id].doctor_id, prescription_id_mapping[last_presc_id].medicine, prescription_id_mapping[last_presc_id].timestamp_prescribed);
    }

    function mark_prescription(uint aadhaar, string memory time) public {
        require(prescription_id_mapping[patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1]].marked == false, "Prescription already marked");
        uint last_presc_id = patient_aadhaar_mapping[aadhaar].prescription_ids[patient_aadhaar_mapping[aadhaar].prescription_ids.length - 1];
        prescription_id_mapping[last_presc_id].pharmacy_id = pharmacy_address_mapping[msg.sender].id;
        prescription_id_mapping[last_presc_id].marked = true;
        prescription_id_mapping[last_presc_id].timestamp_marked = time;
    }

    function add_file(uint aadhaar, string calldata filehash, string calldata timestamp) external {
        patient_aadhaar_mapping[aadhaar].file_ids.push(current_file_id);
        file_id_mapping[current_file_id].file_hash = filehash;
        file_id_mapping[current_file_id].timestamp = timestamp;
        current_file_id = current_file_id + 1;
    }

    function get_files(uint aadhaar) view public returns(string memory, string memory){
        string memory filehash = "";
        string memory time = "";
        filehash = file_id_mapping[patient_aadhaar_mapping[aadhaar].file_ids[patient_aadhaar_mapping[aadhaar].file_ids.length-1]].file_hash;
        time = file_id_mapping[patient_aadhaar_mapping[aadhaar].file_ids[patient_aadhaar_mapping[aadhaar].file_ids.length-1]].timestamp;
        return (filehash, time);
    }

    function request_adding_doctor (uint id, uint license_no, string calldata name, string calldata specialisation, address d_addr) external {
        pending_doc_id_mapping[id].id = id;
        pending_doc_id_mapping[id].license_no = license_no;
        pending_doc_id_mapping[id].name = name;
        pending_doc_id_mapping[id].specialisation = specialisation;
        pending_doc_id_mapping[id].d_addr = d_addr;
        pending_doc_id_mapping[id].d1 = doctor_address_mapping[msg.sender].id;
        pending_doc_id_mapping[id].d1_bool = true;
    }

    function give_consent (uint id) external {
        require(pending_doc_id_mapping[id].d1_bool, "Doctor isn't requested to add in the system");
        pending_doc_id_mapping[id].d2_bool = true;
        doctor_id_mapping[id].id = pending_doc_id_mapping[id].id;
        doctor_id_mapping[id].license_no = pending_doc_id_mapping[id].license_no;
        doctor_id_mapping[id].name = pending_doc_id_mapping[id].name;
        doctor_id_mapping[id].specialisation = pending_doc_id_mapping[id].specialisation;
        doctor_id_mapping[id].doctor_address = pending_doc_id_mapping[id].d_addr;
        doctor_id_mapping[id].d1_id = pending_doc_id_mapping[id].d1;
        doctor_id_mapping[id].d2_id = doctor_address_mapping[msg.sender].id;
        doctor_id_mapping[id].exists = true;
        doctor_id_mapping[id].doctor_address = pending_doc_id_mapping[id].d_addr;
        doctor_auth[pending_doc_id_mapping[id].d_addr] = auth.doc;
    }

}