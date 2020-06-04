// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract MultiSigWallet{

    //<--- Mappings--->
    mapping(address => uint) contributorsMapping;
    mapping(address => bool) signersMapping;
    mapping(address => uint) submittedProposalMapping;
    mapping(address => uint) voteCountMapping;
    mapping(address => uint) approveVotesMapping;
    mapping(address => bool) proposalApprovedMapping;
    mapping(address => mapping(address => uint)) individualVotesMapping;
    mapping(address => mapping(address => uint)) signerVoteMapping;

    //<--- Standalones  --->
    bool contributionState;
    address ownerAddress;
    uint tempContractBal;
    uint endContributionBalance;
    //<--- Arrays --->
    address[] contributorsArray;
    address[] submittedProposalArray;
    address[] signersArray;
    address[] opBen;

    //<--- Constructor Function --->
    constructor() public{
        ownerAddress = msg.sender;
        contributionState = true;
        setSigners();
        signersMapping[msg.sender] = true;
        signersArray.push(msg.sender);
    }

    function addSigner(address signer) public onlySigner {
        signersMapping[signer] = true;
        signersArray.push(signer);
    }

    //<--- Modifiers --->
    modifier onlySigner(){
        require(signersMapping[msg.sender] == true);
        _;
    }
    modifier contributionStateEnd(){
        require(contributionState == false);
        _;
    }
    modifier checkValue(uint _valueInWei){
        uint contractBal = endContributionBalance;
        uint valueAllowed = uint(contractBal * 10) / uint(100);
        require(_valueInWei <= valueAllowed);
        _;
    }
    modifier freshProposalOnly(){
        require(submittedProposalMapping[msg.sender] == 0);
        _;
    }
    modifier noSigner(){
        require(signersMapping[msg.sender] != true);
        _;
    }
    //<--- Modifiers End --->

    //<--- Events --->
    event ReceivedContribution(address indexed _contributor, uint _valueInWei);//Done
    event ProposalSubmitted(address indexed _beneficiary, uint _valueInWei);//Done
    event ProposalApproved(address indexed _approver, address indexed _beneficiary, uint _valueInWei);
    event ProposalRejected(address indexed _approver, address indexed _beneficiary, uint _valueInWei);
    event WithdrawPerformed(address indexed _beneficiary, uint _valueInWei);
    //<--- Events End --->

    //<--- Contribution Functions --->
    function receiveContribution() internal{
        if(contributorsMapping[msg.sender] > 0){
            contributorsMapping[msg.sender] += msg.value;
        }else{
            contributorsMapping[msg.sender] += msg.value;
            contributorsArray.push(msg.sender);
        }
        emit ReceivedContribution(msg.sender,msg.value);
    }
    function endContributionPeriod() external onlySigner{
//        require(address(this).balance > 0);
        require(contributionState == true);
        endContributionBalance = 100000;
        contributionState = false;
    }
    function listContributors() external view returns (address[] memory){
        return contributorsArray;
    }
    function getContributorAmount(address _contributor) external view returns (uint){
        return contributorsMapping[_contributor];
    }
    //<--- Contribution Function Ends --->

    //<--- Submit Proposal Function --->

    function submitProposal(uint _valueInWei) external noSigner contributionStateEnd freshProposalOnly checkValue(_valueInWei){
        require(endContributionBalance - tempContractBal >= _valueInWei);
        require(_valueInWei > 0);
        submittedProposalMapping[msg.sender] = _valueInWei;
        submittedProposalArray.push(msg.sender);
        tempContractBal += _valueInWei;
        opBen.push(msg.sender);
        emit ProposalSubmitted(msg.sender, _valueInWei);
    }
    function listOpenBeneficiariesProposals() external contributionStateEnd view returns (address[] memory){
        // address[] opBen;
        // for(uint i=0;i < submittedProposalArray.length; i++){
        //     if(voteCountMapping[submittedProposalArray[i]] <= 1){
        //         opBen.push(submittedProposalArray[i]);
        //     }
        // }
        return opBen;
    }
    function getBeneficiaryProposal(address _beneficiary) external contributionStateEnd view returns (uint){
        return submittedProposalMapping[_beneficiary];
    }

    //<--- Submit Proposal Function Ends --->

    //<--- Voting Funcitons --->
    function popBeneficiary(address _beneficiary) internal{
        uint index;
        for(uint i=0;i<opBen.length;i++){
            if(_beneficiary == opBen[i]){
                index = i;
                break;
            }
        }
        opBen[index] = opBen[opBen.length - 1];
        opBen.pop();
    }
    function checkIfApproved(address _beneficiary) internal contributionStateEnd{

        if(approveVotesMapping[_beneficiary] >= 2 && voteCountMapping[_beneficiary] >= 2){
            proposalApprovedMapping[_beneficiary] = true;
            //Pop from Submitted Proposal Array <--> INCOMPLETE
            popBeneficiary(_beneficiary);
        }
        if(voteCountMapping[_beneficiary] == 2 && approveVotesMapping[_beneficiary] == 0){
            //It means that the proposal is Rejected
            tempContractBal -= submittedProposalMapping[_beneficiary];
            submittedProposalMapping[_beneficiary] = 0;
            proposalApprovedMapping[_beneficiary] = false;
            voteCountMapping[_beneficiary] = 0;
            approveVotesMapping[_beneficiary] = 0;
            for(uint i=0;i<signersArray.length;i++){
                individualVotesMapping[_beneficiary][signersArray[i]] = 0;
            }
            //Pop from Submitted Proposal Array <--> INCOMPLETE
            popBeneficiary(_beneficiary);
        }
        if(voteCountMapping[_beneficiary] > 2 && approveVotesMapping[_beneficiary] < 2){
            //It means that the proposal is Rejected
            tempContractBal -= submittedProposalMapping[_beneficiary];
            submittedProposalMapping[_beneficiary] = 0;
            proposalApprovedMapping[_beneficiary] = false;
            voteCountMapping[_beneficiary] = 0;
            approveVotesMapping[_beneficiary] = 0;
            for(uint j=0;j<signersArray.length;j++){
                individualVotesMapping[_beneficiary][signersArray[j]] = 0;
            }
            //Pop from Submitted Proposal Array <--> INCOMPLETE
            popBeneficiary(_beneficiary);
        }
    }
    function approve(address _beneficiary) external contributionStateEnd onlySigner{
        require(individualVotesMapping[_beneficiary][msg.sender] == 0);
        individualVotesMapping[_beneficiary][msg.sender] = 1;
        voteCountMapping[_beneficiary] += 1;
        approveVotesMapping[_beneficiary] += 1;
        signerVoteMapping[_beneficiary][msg.sender] = 1;
        checkIfApproved(_beneficiary);
        emit ProposalApproved(msg.sender, _beneficiary, submittedProposalMapping[_beneficiary]);
    }
    function reject(address _beneficiary) external contributionStateEnd onlySigner{
        require(individualVotesMapping[_beneficiary][msg.sender] == 0);
        require(submittedProposalMapping[_beneficiary] > 0);
        individualVotesMapping[_beneficiary][msg.sender] = 1;
        voteCountMapping[_beneficiary] += 1;
        signerVoteMapping[_beneficiary][msg.sender] = 2;
        checkIfApproved(_beneficiary);
        emit ProposalRejected(msg.sender, _beneficiary, submittedProposalMapping[_beneficiary]);
    }
    function getSignerVote(address _signer,address _beneficiary) external view returns(uint){
        return signerVoteMapping[_beneficiary][_signer];
    }
    //<--- Voting Functions End  --->

    //<--- Withdraw Functions --->
    function withdraw(uint _valueInWei) external contributionStateEnd{
        require(proposalApprovedMapping[msg.sender] == true);
        require(submittedProposalMapping[msg.sender] >= _valueInWei);
        if(submittedProposalMapping[msg.sender] == _valueInWei){
            submittedProposalMapping[msg.sender] = 0;
            proposalApprovedMapping[msg.sender] = false;
            voteCountMapping[msg.sender] = 0;
            approveVotesMapping[msg.sender] = 0;
            for(uint i=0;i<signersArray.length;i++){
                individualVotesMapping[msg.sender][signersArray[i]] = 0;
            }
            tempContractBal -= _valueInWei;
            msg.sender.transfer(_valueInWei);
            emit WithdrawPerformed(msg.sender,_valueInWei);
        }else{
            submittedProposalMapping[msg.sender] -= _valueInWei;
            tempContractBal -= _valueInWei;
            msg.sender.transfer(_valueInWei);
            emit WithdrawPerformed(msg.sender,_valueInWei);
        }
    }
    //<--- Withdraw Functions End --->

    //<--- Get Contract Balance Function --->
    function contractBalanceFunc() public view returns(uint){
        return address(this).balance;
    }

    //<--- Set Signers Function --->
    function setSigners()internal{
        signersMapping[address(0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1)] = true;
        signersMapping[address(0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0)] = true;
        signersMapping[address(0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b)] = true;
        signersArray.push(address(0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1));
        signersArray.push(address(0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0));
        signersArray.push(address(0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b));
    }
    //<--- Owner Function --->
    function owner() external view returns(address){
        return ownerAddress;
    }
    //<--- Fallback Function for Receiving Ether --->
    function pay() external payable {
        require(contributionState == true);
        require(msg.value > 0);
        receiveContribution();
    }
}